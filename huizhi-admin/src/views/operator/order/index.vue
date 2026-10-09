<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">

      <el-form-item label="" prop="userId">
        <el-select clearable v-model="queryParams.userId" placeholder="用户">
          <el-option
            v-for="item in userList"
            :key="item.value"
            :label="item.nickName"
            :value="item.userId"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="" prop="orderNumber">
        <el-input
          v-model="queryParams.orderNumber"
          placeholder="订单编号"
          clearable
        />
      </el-form-item>

      <el-form-item label="" prop="stationName">
        <el-input
          v-model="queryParams.stationName"
          placeholder="充电站"
          clearable
        />
      </el-form-item>

      <el-form-item label="" prop="pileId">
        <el-input v-model="queryParams.pileId"
                  placeholder="充电桩编号"
                  clearable
        />
      </el-form-item>

      <el-form-item label="" prop="mobile">
        <el-input v-model="queryParams.mobile"
                  placeholder="手机号"
                  clearable
        />
      </el-form-item>

      <el-form-item label="" prop="orderType">
        <el-select v-model="queryParams.orderType" placeholder="计费类型">
          <el-option
            v-for="dict in dict.type.charging_order_billing_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="" prop="chargingOrderType">
        <el-select clearable v-model="queryParams.chargingOrderType" placeholder="订单类型">
          <el-option
            v-for="dict in dict.type.charging_order_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="" prop="orderState">
        <el-select v-model="queryParams.orderState" placeholder="订单状态" clearable>
          <el-option
            v-for="dict in dict.type.charging_order_status"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
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
        <el-button
          style="margin-left: 30px" class="import-btn"
          @click="resetQuery"
        >重置
        </el-button>

      </el-form-item>
    </el-form>



    <el-table v-loading="loading" :data="orderList">
      <el-table-column
        fixed label="序号"
        width="80"
        align="center">
        <template slot-scope="scope">
          <span>{{(queryParams.pageNum-1)*queryParams.pageSize+(scope.$index + 1)}} </span>
        </template>
      </el-table-column>


      <el-table-column
        prop="orderNumber"
        label="订单号"
        align="center"
        min-width="90"
      ></el-table-column>


      <el-table-column
        prop="stationName"
        label="充电站"
        align="center"
        min-width="80"
      ></el-table-column>

      <el-table-column
        label="订单类型"
        align="center"
        prop="chargingOrderType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charging_order_type" :value="scope.row.chargingOrderType"/>
        </template>
      </el-table-column>

      <el-table-column
        label="计费类型"
        align="center"
        prop="orderType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charging_order_billing_type" :value="scope.row.orderType"/>
        </template>
      </el-table-column>

      <el-table-column
        label="充电状态"
        align="center"
        prop="chargeStatus">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charging_status" :value="scope.row.chargeStatus"/>
        </template>
      </el-table-column>

      <el-table-column
        prop="orderState"
        label="订单状态"
        align="center">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charging_order_status" :value="scope.row.orderState"/>
        </template>
      ></el-table-column>



      <el-table-column
        prop="mobile"
        align="center"
        label="手机号"
        min-width="90"
      ></el-table-column>

      <el-table-column
        prop="pileId"
        label="充电桩编号"
        align="center"
        min-width="100"
      ></el-table-column>

      <el-table-column
        prop="portName"
        label="枪口"
        align="center"
        min-width="60"
        :show-overflow-tooltip="true"
      ></el-table-column>

      <el-table-column
        prop="realHour"
        label="充电时长"
        align="center"
        min-width="80"
      >
        <template slot-scope="scope">
          <span>{{ scope.row.realHour }}h</span>
        </template>
      </el-table-column>

      <el-table-column
        prop="ordergold"
        label="订单金额"
        align="center"
        min-width="80"
      ></el-table-column>

      <el-table-column
        prop="createTime"
        label="创建时间"
        align="center"
        min-width="130"
      ></el-table-column>



      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <div class="editCell">
            <el-button @click="detailHandler(scope.row)">详情</el-button>
          </div>
        </template>


      </el-table-column>
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
import {listOrder, getOrder, delOrder, addOrder, updateOrder} from "@/api/operator/order";
import {parseTime} from "@/utils/hcp";
import {getUserList} from "@/api/system/user";

export default {
  name: "Order",
  dicts: ['charging_order_status', 'charging_order_billing_type','charging_order_type', 'charging_status', 'charging_is_free', 'device_type'],
  data() {
    return {
      // 遮罩层
      loading: true,
      userList:[],
      // 日期范围
      dateRange: [],
      // 选中数组
      ids: [],
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 充电订单表格数据
      orderList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        userId: null,
        orderState: null,
        pileId: null,
        chargeStatus: null,
        isFee: null,
        cardNo: null,
        deviceType: null,
        orderSource: null,
        isGroupOrder: null,
        groupCardNo: null,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        chargeStatus: [
          {required: true, message: "充电状态不能为空", trigger: "change"}
        ],
        isFee: [
          {required: true, message: "是否收费不能为空", trigger: "blur"}
        ],
        deviceType: [
          {required: true, message: "设备类型不能为空", trigger: "change"}
        ],
      }
    };
  },
  created() {
    this.getList();
    this.getUserList();
  },
  methods: {
    /** 查询充电订单列表 */
    getList() {
      this.loading = true;

      this.dateRange = Array.isArray(this.dateRange) ? this.dateRange : [];

      this.queryParams.startTime=this.dateRange[0];
      this.queryParams.endTime=this.dateRange[1];
      listOrder(this.queryParams).then(response => {
        this.orderList = response.data;
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
        orderId: null,
        userId: null,
        orderState: null,
        pileId: null,
        portId: null,
        startTime: null,
        endTime: null,
        orderNumber: null,
        chargeStatus: "0",
        isFee: [],
        consumePower: null,
        chargingCurrent: null,
        chargingCdgl: null,
        customPriceId: null,
        hour: null,
        price: null,
        mobile: null,
        createtime: null,
        code: null,
        cardNo: null,
        ordergold: null,
        orderType: null,
        outTradeNo: null,
        realHour: null,
        realEndTime: null,
        refundAmount: null,
        deviceType: null,
        chargeFee: null,
        serviceFee: null,
        payTime: null,
        orderSource: null,
        isGroupOrder: null,
        groupCardNo: null,
        invoiceId: null,
        invoiceNo: null,
        stopReason: null,
        tenantId: null
      };
      this.resetForm("form");
    },
    getUserList(){
      getUserList().then((res) => {
        this.userList = res.data;
      })
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1;
      this.getList();
    },
    /** 重置按钮操作 */
    resetQuery() {

      this.queryParams.userId = null;
      this.dateRange = [];
      this.queryParams.startTime='';
      this.queryParams.endTime='';
      this.resetForm("queryForm");
      this.handleQuery();

    },

    detailHandler(row) {
      const params = { orderNumber: row.orderNumber };
      this.$tab.openPage("订单详情", '/operate/ordertDetail/',params );

    },
  }
};
</script>
