<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
                  <el-form-item label="" prop="svin">
                    <el-input
                        v-model="queryParams.svin"
                        placeholder="是否支持即插即充"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>

                  <el-form-item label="" prop="equipmentUniqueNumber">
                    <el-input
                        v-model="queryParams.equipmentUniqueNumber"
                        placeholder="设备编码"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
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



    <el-table v-loading="loading" :data="equipmentInfoList">
      <el-table-column prop="equipmentId" label="充电设备唯一标识" align="center" width="120"></el-table-column>
      <el-table-column prop="svin" label="是否支持即插即充" align="center" min-width="120"></el-table-column>
      <el-table-column prop="sautoPower" align="center" label="是否支持自动调节功率" min-width="60"></el-table-column>
      <el-table-column prop="equipmentClassification" align="center" label="设备分类" min-width="80"></el-table-column>
      <el-table-column prop="equipmentUniqueNumber" label="设备唯一编码" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentType" label="设备类型" align="center" min-width="120"></el-table-column>
      <el-table-column prop="power" label="充电设备总功率" align="center" min-width="120"></el-table-column>
      <el-table-column prop="manufacturerId" label="设备生产商组织机构代码" align="center" min-width="120"></el-table-column>
      <el-table-column prop="manufacturerName" label="设备生产商名称" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentModel" label="设备型号" align="center" min-width="120"></el-table-column>
      <el-table-column prop="productionDate" label="设备生产日期" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentLng" label="充电设备经度" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentLat" label="充电设备纬度" align="center" min-width="120"></el-table-column>
      <el-table-column prop="equipmentName" label="充电设备名称" align="center" min-width="160"></el-table-column>
      <el-table-column prop="voltageUpperLimits" label="额定电压上限" align="center" min-width="120"></el-table-column>
      <el-table-column prop="voltageLowerLimits" label="额定电压下限" align="center" min-width="120"></el-table-column>
      <el-table-column prop="current" label="额定电流" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stationId" label="充电站" align="center" min-width="120"></el-table-column>
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
  import { listEquipmentInfo, getEquipmentInfo, delEquipmentInfo, addEquipmentInfo, updateEquipmentInfo } from "@/api/operator/equipmentInfo";
  import {parseTime} from "@/utils/hcp";

  export default {
    name: "EquipmentInfo",
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
        // 设备列表表格数据
              equipmentInfoList: [],
        // 弹出层标题
        title: "",
        // 是否显示弹出层
        open: false,
        // 查询参数
        queryParams: {
          pageNum: 1,
          pageSize: 10,
                        svin: null,
                        sautoPower: null,
                        equipmentClassification: null,
                        equipmentUniqueNumber: null,
                        equipmentType: null,
                        power: null,
                        manufacturerID: null,
                        manufacturerName: null,
                        equipmentModel: null,
                        productionDate: null,
                        equipmentLng: null,
                        equipmentLat: null,
                        equipmentName: null,
                        voltageUpperLimits: null,
                        voltageLowerLimits: null,
                        current: null,
                        stationId: null
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
      /** 查询设备列表列表 */
      getList() {
        this.loading = true;
        listEquipmentInfo(this.queryParams).then(response => {
          this.equipmentInfoList = response.data;
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
                        equipmentID: null,
                        svin: null,
                        sautoPower: null,
                        equipmentClassification: null,
                        equipmentUniqueNumber: null,
                        equipmentType: null,
                        power: null,
                        manufacturerID: null,
                        manufacturerName: null,
                        equipmentModel: null,
                        productionDate: null,
                        equipmentLng: null,
                        equipmentLat: null,
                        equipmentName: null,
                        voltageUpperLimits: null,
                        voltageLowerLimits: null,
                        current: null,
                        stationId: null
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
