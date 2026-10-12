<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">

      <el-form-item label="订单号" prop="ordernumber">
        <el-input
          v-model="queryParams.ordernumber"
          placeholder="请输入订单号"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
                  <el-form-item label="" prop="stationId">
                    <el-input
                        v-model="queryParams.stationId"
                        placeholder="充电站编码"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>
                  <el-form-item label="" prop="equipmentId">
                    <el-input
                        v-model="queryParams.equipmentId"
                        placeholder="充电设备编码"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>

      <el-form-item label="">
        <el-date-picker
          clearable
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
      </el-form-item>
    </el-form>



    <el-table v-loading="loading" :data="orderInfoList">
      <el-table-column prop="orderNo" label="充电订单号" align="center" width="160"></el-table-column>
      <el-table-column prop="connectorId" label="充电接口唯一标识" align="center" min-width="160"></el-table-column>
      <el-table-column prop="operatorId" align="center" label="运营商ID" min-width="60"></el-table-column>
      <el-table-column prop="stationId" align="center" label="充电站ID" min-width="80"></el-table-column>
      <el-table-column prop="equipmentId" label="充电设备ID" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentOwnerId" label="设备所属方ID" align="center" min-width="120"></el-table-column>
      <el-table-column prop="licensePlate" label="车牌号" align="center" min-width="120"></el-table-column>
      <el-table-column prop="vin" label="车辆唯一识别码" align="center" min-width="120"></el-table-column>
      <el-table-column prop="startSoc" label="充电开始SOC" align="center" min-width="120"></el-table-column>
      <el-table-column prop="endSoc" label="充电结束SOC" align="center" min-width="120"></el-table-column>
      <el-table-column prop="startTime" label="本单开始充电时间" align="center" min-width="120"></el-table-column>
      <el-table-column prop="endTime" label="结束充电时间" align="center" min-width="120"></el-table-column>
      <el-table-column prop="cuspElect" label="尖阶段电量" align="center" min-width="120"></el-table-column>
      <el-table-column prop="peakElect" label="峰阶段电量" align="center" min-width="120"></el-table-column>
      <el-table-column prop="flatElect" label="平阶段电量" align="center" min-width="120"></el-table-column>
      <el-table-column prop="valleyElect" label="谷阶段电量" align="center" min-width="120"></el-table-column>
      <el-table-column prop="pushTimeStamp" label="推送时间" align="center" min-width="120"></el-table-column>
      <el-table-column prop="totalElecMoney" label="总电费" align="center" min-width="120"></el-table-column>
      <el-table-column prop="totalSeviceMoney" label="总服务费" align="center" min-width="120"></el-table-column>
      <el-table-column prop="totalMoney" label="累计总金额" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stopReason" label="充电结束原因" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stopDesc" label="充电结束原因描述" align="center" min-width="120"></el-table-column>
      <el-table-column prop="totalPower" label="总耗电量" align="center" min-width="120"></el-table-column>
    </el-table>

    <pagination
        v-show="total>0"
        :total="total"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        @pagination="getList"
    />

  </div>
</template>

<script>
  import { listOrderInfo, getOrderInfo, delOrderInfo, addOrderInfo, updateOrderInfo } from "@/api/operator/orderInfo";
  import {parseTime} from "@/utils/hcp";

  export default {
    name: "OrderInfo",
    data() {
      return {
        // 遮罩层
        loading: true,
        // 选中数组
        ids: [],
        dateRange:[],
        // 非单个禁用
        single: true,
        // 非多个禁用
        multiple: true,
        // 显示搜索条件
        showSearch: true,
        // 总条数
        total: 0,
        // 充电站充电订单信息表格数据
              orderInfoList: [],
        // 弹出层标题
        title: "",
        // 是否显示弹出层
        open: false,
        // 查询参数
        queryParams: {
          pageNum: 1,
          pageSize: 10,
                        connectorId: null,
                        operatorId: null,
                        stationId: null,
                        equipmentId: null,
                        equipmentOwnerId: null,
                        licensePlate: null,
                        vin: null,
                        startSoc: null,
                        endSoc: null,
                        startTime: null,
                        endTime: null,
                        cuspElect: null,
                        peakElect: null,
                        flatElect: null,
                        valleyElect: null,
                        pushTimeStamp: null,
                        totalElecMoney: null,
                        totalSeviceMoney: null,
                        totalMoney: null,
                        stopReason: null,
                        stopDesc: null,
                        sumPeriod: null,
                        chargeDetails: null,
                        totalPower: null,
                        ordernumber: null
        },
        // 表单参数
        form: {},
        // 表单校验
        rules: {
        }
      };
    },
    created() {
      this.getList();
    },
    methods: {
      /** 查询充电站充电订单信息列表 */
      getList() {
        this.loading = true;

        this.dateRange = Array.isArray(this.dateRange) ? this.dateRange : [];

        this.queryParams.startTime=this.dateRange[0];
        this.queryParams.endTime=this.dateRange[1];
        listOrderInfo(this.queryParams).then(response => {
          this.orderInfoList = response.data;
          this.total = response.total;
          this.loading = false;
        });
      },
      // 取消按钮
      cancel() {
        this.open = false;
        this.reset();
      },
      // 表单重置
      reset() {
        this.form = {
                        orderNo: null,
                        connectorId: null,
                        operatorId: null,
                        stationId: null,
                        equipmentId: null,
                        equipmentOwnerId: null,
                        licensePlate: null,
                        vin: null,
                        startSoc: null,
                        endSoc: null,
                        startTime: null,
                        endTime: null,
                        cuspElect: null,
                        peakElect: null,
                        flatElect: null,
                        valleyElect: null,
                        pushTimeStamp: null,
                        totalElecMoney: null,
                        totalSeviceMoney: null,
                        totalMoney: null,
                        stopReason: null,
                        stopDesc: null,
                        sumPeriod: null,
                        chargeDetails: null,
                        totalPower: null,
                        ordernumber: null
        };
        this.resetForm("form");
      },
      /** 搜索按钮操作 */
      handleQuery() {
        this.queryParams.pageNum = 1;
        this.getList();
      },

   }
  };
</script>
