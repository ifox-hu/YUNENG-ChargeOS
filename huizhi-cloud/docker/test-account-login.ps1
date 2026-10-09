$ErrorActionPreference = 'Stop'
$baseUri = 'http://127.0.0.1:38080/hcp-mp/v1/auth/account/'
$fixtureName = 'qa_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$fixtureMobile = '199' + (Get-Random -Minimum 10000000 -Maximum 99999999)
$fixturePassword = 'AccountTest123!'
$fixtureId = $null
$demoToken = $null
$fixtureToken = $null
function Request-Account($route, $data) {
    Invoke-RestMethod ($baseUri + $route) -Method Post -ContentType 'application/x-www-form-urlencoded' -Body $data -TimeoutSec 15
}
function Assert-Result($condition, $name) {
    if (-not $condition) { throw "FAIL: $name" }
    Write-Output "PASS: $name"
}
try {
    $demo = Request-Account 'login' @{username='demo';password='Demo123456!'}
    Assert-Result ($demo.code -eq 200 -and $demo.data.token -and $demo.data.member.memberId) 'demo account login'
    $demoToken = $demo.data.token
    $bad = Request-Account 'login' @{username='demo';password='incorrect'}
    Assert-Result ($bad.code -ne 200) 'wrong password rejected'
    $invalid = Request-Account 'code' @{mobile='123'}
    Assert-Result ($invalid.code -ne 200) 'invalid mobile rejected'
    $otp = Request-Account 'code' @{mobile=$fixtureMobile}
    Assert-Result ($otp.code -eq 200 -and $otp.data.localTest -and $otp.data.testCode) 'explicit local test code'
    $repeat = Request-Account 'code' @{mobile=$fixtureMobile}
    Assert-Result ($repeat.code -ne 200) 'code resend cooldown'
    $form = @{username=$fixtureName;password=$fixturePassword;mobile=$fixtureMobile;code='invalid'}
    $badCode = Request-Account 'register' $form
    Assert-Result ($badCode.code -ne 200) 'incorrect registration code rejected'
    $form.code=$otp.data.testCode
    $registered = Request-Account 'register' $form
    Assert-Result ($registered.code -eq 200) 'account registered'
    $login = Request-Account 'login' @{username=$fixtureName;password=$fixturePassword}
    Assert-Result ($login.code -eq 200 -and $login.data.member.mobile -eq $fixtureMobile) 'new account login'
    $fixtureId=$login.data.member.memberId
    $fixtureToken=$login.data.token
    $duplicate = Request-Account 'register' $form
    Assert-Result ($duplicate.code -ne 200) 'used verification code rejected'
    $balance = Invoke-RestMethod ("http://127.0.0.1:38080/hcp-mp/me/getMemberBalanceByUserId?userId=$fixtureId") -Headers @{token=('Bearer '+$fixtureToken)} -TimeoutSec 15
    Assert-Result ($balance.code -eq 200 -and $balance.data.amount -eq 0) 'initial balance is zero'
    $rows = docker exec -e MYSQL_PWD=password hcp-mysql mysql -uroot -Nse "SELECT password_hash LIKE '$2%' FROM vctgo_platform.c_app_account WHERE username='$fixtureName';"
    Assert-Result ($rows -eq '1') 'password stored as BCrypt hash'
    $redisKey='member:token:'+$fixtureToken
    $present = docker exec hcp-redis redis-cli -n 5 EXISTS $redisKey
    Assert-Result ($present -eq '1') 'session saved in Redis'
    $expired = Invoke-RestMethod ($baseUri+'logout') -Method Post -Headers @{token=('Bearer '+$fixtureToken)} -TimeoutSec 15
    $absent = docker exec hcp-redis redis-cli -n 5 EXISTS $redisKey
    Assert-Result ($expired.code -eq 200 -and $absent -eq '0') 'logout removes server session'
} finally {
    if ($demoToken) { Invoke-RestMethod ($baseUri+'logout') -Method Post -Headers @{token=('Bearer '+$demoToken)} -TimeoutSec 15 | Out-Null }
    if ($fixtureToken) { Invoke-RestMethod ($baseUri+'logout') -Method Post -Headers @{token=('Bearer '+$fixtureToken)} -TimeoutSec 15 | Out-Null }
    # Remove only this run's fixture, matching both unique account and generated mobile.
    $sql="START TRANSACTION; SET @qa_member=(SELECT member_id FROM vctgo_platform.c_app_account WHERE username='$fixtureName' AND mobile='$fixtureMobile'); DELETE FROM vctgo_platform.c_menber_balance WHERE member_id=@qa_member; DELETE FROM vctgo_platform.c_app_account WHERE member_id=@qa_member AND username='$fixtureName'; DELETE FROM vctgo_platform.c_member WHERE member_id=@qa_member AND mobile='$fixtureMobile' AND weixin_openid LIKE 'ACCOUNT_%'; COMMIT;"
    docker exec -e MYSQL_PWD=password hcp-mysql mysql -uroot -e $sql
    docker exec hcp-redis redis-cli -n 5 DEL ("app:register-code:"+$fixtureMobile) ("app:register-code:"+$fixtureMobile+':cooldown') ("app:login-attempts:"+$fixtureName) | Out-Null
}
