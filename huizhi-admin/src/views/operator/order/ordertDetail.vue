<template>
  <div class="main" style="padding: 20px;background-color: rgb(231,234,238)">

    <div class="content-box" style="background-color: white;padding: 20px">
      <div class="top-title">
        <div>
          <span>订单号：{{ data.orderNumber }}</span>
          <span>订单状态：{{ orderState[data.orderState * 1 - 1] }}</span>
          <span>充电时长：{{ data.realHour ? data.realHour : "0" }}小时</span>
        </div>
        <div>
<!--          <el-button-->
<!--              class="btmsdd"-->
<!--              type="primary"-->
<!--              icon="el-icon-connection"-->
<!--              @click="dialogVisible = true"-->
<!--          >订单状态跟踪</el-button-->
<!--          >-->
          <el-button
              class="btmsdd"
              type="primary"
              icon="el-icon-arrow-left"
              @click="back"
          >返回</el-button
          >
        </div>
      </div>
    </div>
    <div class="content-box"  style="background-color: white;padding: 20px">
      <div class="tipjd-box">
        <div class="jt-item" v-for="(item, index) in data.logList" :key="index">
          <span class="line" v-if="index != data.logList.length - 1"></span>
          <p><i class="el-icon-success"></i></p>
          <h3>{{ item.briefInfo }}</h3>
          <h4>{{ item.createTime }}</h4>
        </div>
      </div>
    </div>
    <div class="content-box"  style="background-color: white;padding: 20px">
      <div class="info-box">
        <div class="item-li" style="width: 25%">
          <h3>费用信息</h3>
          <p>实际支付金额：{{ data.ordergold }}元</p>
          <p>充电费用：{{ data.chargeFee ? data.chargeFee : "0" }}元</p>
          <p>服务费：{{ data.serviceFee ? data.serviceFee : "0" }}元</p>
          <h3>支付信息</h3>
          <p>支付方式：{{ data.cardNo ? "卡支付" : "在线支付" }}</p>
          <p>支付状态：{{ data.payTime ? "已支付" : "未支付" }}</p>
          <p>支付时间：{{ data.payTime }}</p>
          <p>是否团体订单：{{ data.isGroupOrder=='1'?'是':'否' }}</p>
          <p>团体卡号：{{ data.groupCardNo?data.groupCardNo:'' }}</p>
        </div>
        <div class="item-li" style="width: 50%">
          <h3>设备信息</h3>
          <div style="display: flex;">
            <div style="margin-right: 10%">
              <p>地址：{{ data.address }}</p>
              <p>设备编号：{{ data.pileId }}</p>
              <p>设备名称：{{ data.pileName }}</p>
              <p>设备类型：{{ data.pileType == 1 ? "快充" : "慢充" }}</p>
              <p>枪口：{{ data.portName }}</p>
              <p>充电时长：{{ data.realHour ? data.realHour : "0" }}小时</p>
              <p>电流：{{ data.electricity }}A</p>
              <p>电压：{{ data.voltage }}V</p>
            </div>
            <div>
              <p>最大功率：{{ data.maxPower }}kW</p>
              <p>
                已充电量：{{ data.consumePower ? data.consumePower : "0" }}kwh
              </p>
            </div>
          </div>
        </div>
        <div class="item-li" style="width: 25%">
          <h3>用户信息</h3>
          <p>用户名：{{ data.userName }}</p>
          <p>手机号：{{ data.mobile }}</p>
        </div>
      </div>
    </div>
    <el-dialog title="订单状态跟踪" :visible.sync="dialogVisible" width="500px">
      <div class="track-step">
        <div class="track-item" v-for="(item, index) in logList" :key="index">
          <img class="slot-icon" src="@/assets/order-step.png" />
          <div class="track-step-item">
            <div class="step-time">
              {{ item.createTime }}
            </div>
            <div
                class="step-info"
                :style="{ color: item.mainProcess == 0 ? '#E06E11' : '' }"
            >
              {{ item.logContent }}
            </div>
            <div class="line" v-if="index < logList.length - 1"></div>
          </div>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="dialogVisible = false"
        >关 闭</el-button
        >
      </span>
    </el-dialog>
  </div>
</template>
<script>
import { getOrderByOrderNumber } from "@/api/operator/order";
export default {
  data() {
    return {
      dialogVisible: false,
      orderNumber: this.$route.query.orderNumber,
      data: { logList: [] },
      orderState: ["下单", "取消", "支付成功", "退款", "完成"],
      logList: [],
    };
  },
  created() {
    this.getOrderData();
    // this.getOrderTrace();
  },
  methods: {
    getOrderData() {

      getOrderByOrderNumber(this.orderNumber).then((res) => {
        if (res.code == 200) {
          this.data = res.data;
        }
      });
    },
    back() {
      this.$router.back();
    },
  },
};
</script>
<style scoped lang="scss">
.top-title {
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  line-height: 40px;
}
.top-title span {
  margin: 0 20px;
  color: #333;
}
.tipjd-box {
  display: flex;
}
.tipjd-box .jt-item {
  width: 33.3%;
  text-align: center;
  position: relative;
}
.tipjd-box .jt-item .line {
  position: absolute;
  width: calc(100% - 60px);
  margin: 0 30px;
  border-bottom: 2px solid var(--current-color);
  top: 29px;
}
.tipjd-box .jt-item p .el-icon-success {
  font-size: 45px;
  margin-bottom: 15px;
  color: var(--current-color);
}
.tipjd-box .jt-item h3 {
  color: #333;
  line-height: 30px;
  font-size: 16px;
}
.tipjd-box .jt-item h4 {
  color: #333;
  line-height: 30px;
  font-size: 14px;
}
.info-box {
  display: flex;
}
.info-box .item-li {
  width: 33.33%;
}
.info-box .item-li h3 {
  font-size: 16px;
  color: #666;
  line-height: 40px;
}
.info-box .item-li p {
  font-size: 14px;
  color: #333;
  line-height: 30px;
}

.track-step {
  margin: 0 10px;

  .track-item {
    display: flex;
    align-items: flex-start;
    position: relative;
    height: 80px;
    &:last-child{
      height: 100% !important;
    }

    .line {
      position: absolute;
      left: 6px;
      top: 13px;
      height: 70px;
      border-left: 1px dashed #999;
    }

    .step-time {
      margin-top: -2px;
      font-size: 14px;
      margin-bottom: 10px;
      font-weight: bold;
      color: #444444;
    }

    .step-info {
      font-size: 13px;
      color: #666666;
    }
  }

  .slot-icon {
    width: 13px;
    height: 13px;
    margin-right: 9px;
  }
}
</style>
