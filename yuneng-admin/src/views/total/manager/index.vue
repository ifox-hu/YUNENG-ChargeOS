<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item>
        <el-select
          clearable
          v-model="queryParams.userId"
          placeholder="请选择用户"
          style="width: 140px;"
        >
          <el-option
            v-for="item in userList"
            :key="item.value"
            :label="item.nickName"
            :value="item.userId"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="" prop="plotName">
        <el-input
          v-model="queryParams.plotName"
          placeholder="请输入站点名称"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="" prop="chargeNo">
        <el-input
          v-model="queryParams.chargeNo"
          placeholder="请输入充电桩编号"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>



      <el-form-item label="">
        <el-select
          v-model="queryParams.runningStatus"
          placeholder="运行状态"
          clearable
          style="width: 240px"
        >
          <el-option
            v-for="dict in dict.type.pile_running_status"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="">
        <el-date-picker
          v-model="dateRange"
          style="width: 240px"
          value-format="yyyy-MM-dd"
          type="daterange"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        ></el-date-picker>
      </el-form-item>

      <el-form-item>
        <el-button
          style="margin-left: 30px" class="import-btn"
          type="primary"
          @click="handleQuery"
        >搜索
        </el-button>
        <el-button
          style="margin-left: 30px" class="import-btn"
          type="primary"
          @click="exporthandlerTotal"
        >导出统计数据
        </el-button>

        <el-button
          style="margin-left: 20px"
          class="import-btn"
          type="primary"
          @click="exporthandler"
        >导出列表数据
        </el-button>
      </el-form-item>
    </el-form>

    <div class="">
      <div class="userStatisticsMain">
        <div
          class="topHead"
          element-loading-spinner="el-icon-loading"
          element-loading-background="rgba(0, 0, 0, 0.8)"
        >
          <div class="content-top">
            <div
              class="topItem"
              v-for="(item, index) in topInfoArray"
              :key="index"
              @click="openUrl(item.url)"
            >
              <img :src="item.img" alt="" />
              <div class="flex-right">
                <div class="topItemName">
                  {{ item.name }}
                </div>
                <div class="topItemValue">
                  {{ item.value }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <el-table :data="tableData" border style="width: 100%">
        <el-table-column fixed label="序号" min-width="20%"   align="center">
          <template slot-scope="scope">
            <span>{{(queryParams.pageNum-1)*queryParams.pageSize+(scope.$index + 1)}} </span>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="plotId" align="center" label="站点ID" min-width="80" :show-overflow-tooltip="true"></el-table-column> -->

        <el-table-column
          prop="plotName"
          align="center"
          label="站点名称"
          min-width="100"
          :show-overflow-tooltip="true"
        ></el-table-column>
        <el-table-column
          prop="chargeNo"
          label="充电桩编号"
          align="center"
          min-width="100"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{ scope.row.chargeNo }}
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="chargeName"
          label="充电桩名称"
          align="center"
          min-width="100"
          :show-overflow-tooltip="true"
        ></el-table-column>

        <el-table-column
          prop="chargeTotalHour"
          label="充电时长"
          align="center"
          min-width="80"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{ scope.row.chargeTotalHour }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="totalPowerConsumption"
          label="累计电量"
          align="center"
          min-width="80"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{ scope.row.totalPowerConsumption }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="totalAmount"
          label="累计费用"
          align="center"
          min-width="80"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{scope.row.totalAmount }}
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="chargeFee"
          label="累计电费"
          align="center"
          min-width="80"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{scope.row.chargeFee }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="serviceFee"
          label="累计服务费"
          align="center"
          min-width="80"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{scope.row.serviceFee}}
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="chargeTotalTimes"
          label="充电次数"
          align="center"
          min-width="60"
        >
          <template slot-scope="scope">
            <div class="num-text">
              {{ scope.row.chargeTotalTimes }}
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="runningStatus"
          align="center"
          label="运行状态"
          min-width="120"
        >
          <template slot-scope="scope">
            <img
              src="@/assets/wifiGreen.png"
              v-if="scope.row.runningStatus == '0'"
              style="width: 20px; height: 20px"
            />
            <img src="@/assets/wifi.png" v-else style="width: 20px; height: 20px" />
          </template>
        </el-table-column>
      </el-table>
    </div>


    <pagination
      v-show="total>0"
      :total="total"
      :page.sync="queryParams.pageNum"
      :limit.sync="queryParams.pageSize"
      @pagination="getPileList"
    />


  </div>
</template>

<script>


import {getChargeTotal} from "@/api/manager/device";
import {getManageTotalData} from "@/api/manager/statistics";
import {getUserList} from "@/api/system/user"
import {parseTime} from "@/utils/hcp";

export default {
  name: "manager",
  dicts: ['pile_running_status'],
  data() {
    return {
      // 遮罩层
      loading: true,

      // 显示搜索条件
      showSearch: true,

      // 日期范围
      dateRange: [],
      userList:[],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        startTime: '',
        endTime: '',

      },
      // 表单参数
      form: {},
      total: 0,
      tableData: [],

      topInfoArray: [
        {
          name: "总收益(元)",
          value: "",
          prop: "sumSales",
          img: require("../../../assets/index/total_1.png"),
        },

        {
          name: "实际收益(元)",
          value: "",
          prop: "realSales",
          img: require("../../../assets/index/total_2.png"),
        },
        {
          name: "订单退款(元)",
          value: "",
          prop: "reSales",
          img: require("../../../assets/index/total_3.png"),
        },
        {
          name: "电费(元)",
          value: "",
          prop: "chargeFee",
          img: require("../../../assets/index/total_4.png"),
        },
        {
          name: "服务费(元)",
          value: "",
          prop: "serviceFee",
          img: require("../../../assets/index/total_5.png"),
        },
        {
          name: "订单数量",
          value: "",
          prop: "sumCount",
          img: require("../../../assets/index/total_6.png"),
        },
        {
          name: "充电次数",
          value: "",
          prop: "chargeTimes",
          img: require("../../../assets/index/total_7.png"),
        },
        {
          name: "充电时长(小时)",
          value: "",
          prop: "realHour",
          img: require("../../../assets/index/total_8.png"),
        },
        {
          name: "总耗电量(kw/h)",
          value: "",
          prop: "consumePower",
          img: require("../../../assets/index/total_9.png"),
        },
        {
          name: "设备总数",
          value: "",
          prop: "totalNumbers",
          img: require("../../../assets/index/total_10.png"),
        },
        {
          name: "运行设备",
          value: "",
          prop: "onLine",
          img: require("../../../assets/index/total_11.png"),
        },
        {
          name: "离线设备",
          value: "",
          prop: "offLine",
          img: require("../../../assets/index/total_12.png"),
        },
      ],
      topInfoObject: {},
    };
  },
  created() {
    this.getDataList();
  },
  methods: {
    // 表单重置
    reset() {
      this.form = {
        dictId: undefined,
        dictName: undefined,
        dictType: undefined,
        status: "0",
        remark: undefined
      };
      this.resetForm("form");
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1;
      this.loading = true;
      this.getDataList();
    },
    /** 重置按钮操作 */
    resetQuery() {

      this.resetForm("queryForm");
      this.handleQuery();
    },
    getDataList() {

      this.loading = true;
      this.dateRange = Array.isArray(this.dateRange) ? this.dateRange : [];

      this.queryParams.startTime=this.dateRange[0];
      this.queryParams.endTime=this.dateRange[1];

      this.getPileList();
      this.getStatisticsData();
      this.getUserList();


      // this.topInfoArrayFun()
    },
    getUserList(){
      getUserList().then((res) => {
        this.userList = res.data;
      })
    },
    getPileList(){
      getChargeTotal(this.queryParams).then((res) => {
        if (res.data && res.data.length >= 0) {
          this.tableData = [...res.data];
          this.total = res.total;
        }
        this.loading = false;
      })
    },
    getStatisticsData(){
      getManageTotalData(this.queryParams).then((res) => {
        this.topInfoObject = Object.assign(this.topInfoObject, res.data);

        this.topInfoArray.forEach((currentItem) => {
          for (const key in this.topInfoObject) {
            if (key == currentItem.prop) {
              currentItem.value =  this.topInfoObject[key];
            }
          }
        });
      });
    },


    exporthandler() {
      this.$confirm("确定将列表导出吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }).then(() => {
        this.download('/operator/total/downloadManageTotalData', {
          ...this.queryParams
        }, `经营管理统计数据_${parseTime(new Date().getTime(), '{y}-{m}-{d}') }.xlsx`)
      });


    },

    exporthandlerTotal() {
      this.$confirm("确定将数据导出吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }).then(() => {
        this.download('/operator/total/downloadStationList', {
          ...this.queryParams
        }, `经营管理站点列表_${parseTime(new Date().getTime(), '{y}-{m}-{d}') }.xlsx`)


      });
    },
  }
};
</script>
<style lang="scss" scoped>
.num-text {
  font-size: 14px;
  color: #337ab7;
}
// 去除input Number的箭头
::v-deep input::-webkit-outer-spin-button,
::v-deep input::-webkit-inner-spin-button {
  -webkit-appearance: none !important;
}
::v-deep input[type="number"] {
  -moz-appearance: textfield;
}
.title {
  display: flex;
  flex-direction: row;

  .import-btn,
  .switch-btn {
    img {
      width: 16px;
      height: 16px;
      vertical-align: middle;
    }
  }
}

// .data {
//   margin-left: 20px;
//   margin-top: 20px;
//   margin-right: 10px;
// }

.tree {
  position: absolute;
  z-index: 10;
  top: 40px;
  width: 300px;
}

// .is-disabled .el-input__inner {
//   background: #22425b !important;
//   border-color: #22425b !important;
// }

// .el-button--primary {
//   background-color: #02529d;
//   border: none;
// }

.userStatisticsMain {
  margin-top: 20px;
  width: 100%;
  height: 100%;
  position: relative;

  .topHead {
    width: 100%;
    .content-top {
      width: 100%;
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      .topItem {
        img {
          padding-left: 10px;
          height: 54px;
          height: 54px;
          margin-right: 16px;
        }
        &:nth-child(6n) {
          margin-right: 0;
        }
        margin-right: 16px;
        background-color: #fff;
        padding: 10px;
        width: calc(16.6% - 13px);
        margin-bottom: 19px;
        height: 128px;
        display: flex;
        align-items: center;
        font-size: 20px;
        color: #666666;
        .topItemName {
          font-size: 14px;
          color: #000000;
          opacity: 0.45;
          margin-bottom: 20px;
        }
      }
    }
  }
  .chart {
    // width: 100%;
    height: 350px;
  }

  .chart2 {
    // width: 100%;
    height: 350px;
  }

  .table2 {
    width: 100%;
  }

  .content {
    height: calc(100% - 20px);
    width: 100%;
    margin-top: 10px;
  }

  ::v-deep .el-scrollbar__wrap {
    overflow-x: hidden;
  }

  @keyframes backgroundAnimation {
    from {
      background-color: #10223a;
    }

    to {
      background-color: #1a5cd6;
    }
  }

  @keyframes colorAnimation {
    from {
    }

    to {
      color: #fff;
    }
  }
}

::v-deep .el-dialog {
  width: 20%;
}
</style>
