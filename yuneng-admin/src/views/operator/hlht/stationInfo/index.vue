<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">


      <el-form-item label="" prop="stationName">
        <el-input
          v-model="queryParams.stationName"
          placeholder="站点"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="" prop="operatorId">
        <el-input
          v-model="queryParams.operatorId"
          placeholder="运营商ID"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>

      <el-form-item label="" prop="stationStatus">
        <el-select clearable v-model="queryParams.stationStatus" placeholder="站点状态">
          <el-option
            v-for="dict in dict.type.hlht_station_status"
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


    <el-table v-loading="loading" :data="stationInfoList">
      <el-table-column prop="stationId" label="站点ID" align="center" width="100"></el-table-column>
      <el-table-column prop="stationName" label="站点名称" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stationUniqueNumber" align="center" label="站点编码" min-width="60"></el-table-column>
      <el-table-column prop="equipmentOwnerId" align="center" label="基础设施运营商" min-width="80"></el-table-column>
      <el-table-column prop="operatorId" label="运营商ID" align="center" min-width="120"></el-table-column>
      <el-table-column prop="areaCode" label="省市辖区的区县代码" align="center" min-width="120"></el-table-column>
      <el-table-column prop="address" label="充电站详细地址" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stationStatus" label="站点状态" align="center" min-width="120">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.hlht_station_status" :value="scope.row.stationStatus"/>
        </template>
      </el-table-column>
      <el-table-column prop="stationLng" label="站点经度" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stationLat" label="站点维度" align="center" min-width="120"></el-table-column>
      <el-table-column prop="stationTel" label="站点电话" align="center" min-width="120"></el-table-column>
      <el-table-column prop="serviceFee" label="服务费" align="center" min-width="120"></el-table-column>
      <el-table-column prop="electricityFee" label="充电电费描述" align="center" min-width="120"></el-table-column>
      <el-table-column prop="parkFee" label="停车描述" align="center" min-width="120"></el-table-column>
      <el-table-column prop="buildTime" label="建站时间" align="center" min-width="120"></el-table-column>

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
  import { listStationInfo, getStationInfo, delStationInfo, addStationInfo, updateStationInfo } from "@/api/operator/stationInfo";
  import {parseTime} from "@/utils/hcp";

  export default {
    name: "StationInfo",
    dicts:['hlht_station_status'],
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
        // 站点信息表格数据
              stationInfoList: [],
        // 弹出层标题
        title: "",
        // 是否显示弹出层
        open: false,
        // 查询参数
        queryParams: {
          pageNum: 1,
          pageSize: 10,
                        stationName: null,
                        stationStatus: null,

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
      /** 查询站点信息列表 */
      getList() {
        this.loading = true;
        listStationInfo(this.queryParams).then(response => {
          this.stationInfoList = response.data;
          this.total = response.total;
          this.loading = false;
        });
      },

      // 表单重置
      reset() {
        this.form = {
                        stationName: null,
          stationStatus: "0",

        };
        this.resetForm("form");
      },
      /** 搜索按钮操作 */
      handleQuery() {
        this.queryParams.pageNum = 1;
        this.getList();
      },
      /** 重置按钮操作 */
      resetQuery() {
        this.resetForm("queryForm");
        this.handleQuery();
      },

   }
  };
</script>
