<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
                  <el-form-item label="" prop="voltageUpperLimits">
                    <el-input
                        v-model="queryParams.connectorId"
                        placeholder="充电设备接口编码"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>
      <el-form-item label="" prop="parkNo">
        <el-input
          v-model="queryParams.parkNo"
          placeholder="车位号"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>

      <el-form-item label="" prop="stationStatus">
        <el-select clearable v-model="queryParams.stationStatus" placeholder="运营状态">
          <el-option
            v-for="dict in dict.type.hlht_operate_status"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          ></el-option>
        </el-select>
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



    <el-table v-loading="loading" :data="connectorInfoList">
      <el-table-column prop="connectorId" label="充电设备接口编码" align="center" width="120"></el-table-column>
      <el-table-column prop="connectorType" label="充电设备接口类" align="center" min-width="120"></el-table-column>
      <el-table-column prop="voltageUpperLimits" align="center" label="额定电压上限" min-width="60"></el-table-column>
      <el-table-column prop="voltageLowerLimits" align="center" label="额定电压下限" min-width="80"></el-table-column>
      <el-table-column prop="current" label="额定电流" align="center" min-width="120"></el-table-column>
      <el-table-column prop="power" label="额定功率" align="center" min-width="120"></el-table-column>
      <el-table-column prop="nationalStandard" label="国家标准" align="center" min-width="120"></el-table-column>
      <el-table-column prop="connectorName" label="充电设备接口名称" align="center" min-width="120"></el-table-column>
      <el-table-column prop="parkNo" label="车位号" align="center" min-width="120"></el-table-column>
      <el-table-column prop="constantVoltageUpperLimits" label="恒功率电压上限" align="center" min-width="120"></el-table-column>
      <el-table-column prop="constantVoltageLowerLimits" label="恒功率电压下限" align="center" min-width="120"></el-table-column>
      <el-table-column prop="constantCurrentUpperLimits" label="恒功率电流上限" align="center" min-width="120"></el-table-column>
      <el-table-column prop="constantCurrentLowerLimits" label="恒功率电流下限" align="center" min-width="120"></el-table-column>
      <el-table-column prop="auxPower" label="辅助电源" align="center" min-width="120"></el-table-column>
      <el-table-column prop="opreateStatus" label="运营状态" align="center" min-width="120"></el-table-column>
      <el-table-column prop="opreateHours" label="运营时间" align="center" min-width="120"></el-table-column>
      <el-table-column prop="powerMax" label="最大充电功率" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentClassification" label="设备接口分类" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentId" label="归属设备" align="center" min-width="120"></el-table-column>
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
  import { listConnectorInfo, getConnectorInfo, delConnectorInfo, addConnectorInfo, updateConnectorInfo } from "@/api/operator/connectorInfo";
  import {parseTime} from "@/utils/hcp";

  export default {
    name: "ConnectorInfo",
    dicts:['hlht_operate_status'],
    data() {
      return {
        // 遮罩层
        loading: true,
        // 选中数组
        ids: [],
        // 非单个禁用
        single: true,
        // 非多个禁用
        multiple: true,
        // 显示搜索条件
        showSearch: true,
        // 总条数
        total: 0,
        // 接口信息表格数据
        connectorInfoList: [],
        // 弹出层标题
        title: "",
        // 是否显示弹出层
        open: false,
        // 查询参数
        queryParams: {
          pageNum: 1,
          pageSize: 10,
          connectorId: null,
          parkNo: null,
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
      /** 查询接口信息列表 */
      getList() {
        this.loading = true;
        listConnectorInfo(this.queryParams).then(response => {
          this.connectorInfoList = response.data;
          this.total = response.total;
          this.loading = false;
        });
      },

      /** 搜索按钮操作 */
      handleQuery() {
        this.queryParams.pageNum = 1;
        this.getList();
      },

   }
  };
</script>
