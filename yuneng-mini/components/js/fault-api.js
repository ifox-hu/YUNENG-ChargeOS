import request from './request.js'
export const statuses = { NEW:'待分配', ASSIGNED:'已分配', PROCESSING:'处理中', RESOLVED:'待确认', CLOSED:'已关闭' }
export const faultTypes = [
  { value:'OFFLINE', label:'设备离线' }, { value:'CONNECTOR', label:'充电枪故障' },
  { value:'POWER', label:'供电异常' }, { value:'OTHER', label:'其他故障' }
]
export const faultLabel = value => (faultTypes.find(x => x.value === value) || {}).label || value
export function faultRequest(url, method='GET', data={}) {
  return new Promise((resolve,reject) => {
    request({url:'fault/'+url,method,data,
      success:res=>{
        if(res.data && res.data.code===200) resolve(res.data.data)
        else {
          if(res.data && res.data.code===401) {
            uni.removeStorageSync('token')
            uni.showToast({title:'请重新登录',icon:'none'})
            uni.navigateTo({url:'/pages/user/login'})
          }
          reject(new Error((res.data && res.data.msg)||'请求失败，请稍后重试'))
        }
      },fail:()=>reject(new Error('网络连接失败，请稍后重试'))
    })
  })
}

