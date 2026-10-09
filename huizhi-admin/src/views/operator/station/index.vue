<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="站点名称" prop="stationName">
        <el-input
          v-model="queryParams.stationName"
          placeholder="请输入站点名称"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="地址" prop="address">
        <el-input
          v-model="queryParams.address"
          placeholder="请输入地址"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="平台类型" prop="deviceType">
        <el-select v-model="queryParams.deviceType" placeholder="请选择平台类型" clearable>
          <el-option
            v-for="dict in dict.type.device_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="互联互通" prop="isHlht">
        <el-select v-model="queryParams.isHlht" placeholder="请选择是否来自互联互通" clearable>
          <el-option
            v-for="dict in dict.type.sys_yes_no"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="互联编号" prop="hlhtId">
        <el-input
          v-model="queryParams.hlhtId"
          placeholder="请输入互联互通编号"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">搜索</el-button>
        <el-button icon="el-icon-refresh" size="mini" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="el-icon-plus"
          size="mini"
          @click="handleAdd"
          v-hasPermi="['operator:station:add']"
        >新增
        </el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="el-icon-edit"
          size="mini"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['operator:station:edit']"
        >修改
        </el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="el-icon-delete"
          size="mini"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['operator:station:remove']"
        >删除
        </el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="el-icon-download"
          size="mini"
          @click="handleExport"
          v-hasPermi="['operator:station:export']"
        >导出
        </el-button>
      </el-col>
      <right-toolbar :showSearch.sync="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="stationList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center"/>
      <el-table-column label="站点名称" width="120" align="center" prop="stationName"/>
      <el-table-column label="地址" width="160" align="center" prop="address"/>
      <el-table-column label="经度" align="center" prop="lat"/>
      <el-table-column label="纬度" align="center" prop="lng"/>
      <el-table-column label="停车信息" align="center" prop="parkCarInfo"/>
      <el-table-column label="站点图片" align="center" prop="fileId" width="100">
        <template slot-scope="scope">
          <image-preview :src="scope.row.fileId" :width="50" :height="50"/>
        </template>
      </el-table-column>
      <el-table-column label="平台类型" align="center" prop="deviceType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.device_type" :value="scope.row.deviceType"/>
        </template>
      </el-table-column>
      <el-table-column label="开票信息" align="center" prop="receiptStatus">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.plot_receipt_status" :value="scope.row.receiptStatus"/>
        </template>
      </el-table-column>
      <el-table-column label="配套设施" align="center" prop="supportingFacilities">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.plot_supporting_facilities"
                    :value="scope.row.supportingFacilities ? scope.row.supportingFacilities.split(',') : []"/>
        </template>
      </el-table-column>
      <el-table-column label="停车费" align="center" prop="parkCarStatus">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.plot_park_car_status" :value="scope.row.parkCarStatus"/>
        </template>
      </el-table-column>
      <el-table-column label="互联互通编号" align="center" prop="hlhtId"/>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['operator:station:edit']"
          >修改
          </el-button>
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['operator:station:remove']"
          >删除
          </el-button>
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

    <!-- 添加或修改站点对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="800px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="站点名称" prop="stationName">
          <el-input v-model="form.stationName" placeholder="请输入站点名称"/>
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入地址"/>
        </el-form-item>
        <el-form-item label="所属地区代码" prop="regionCode">
          <el-input v-model="form.regionCode" placeholder="请输入所属地区代码"/>
        </el-form-item>
        <el-form-item label="经度" prop="lat">
          <el-input v-model="form.lat" placeholder="请输入经度"/>
        </el-form-item>
        <el-form-item label="纬度" prop="lng">
          <el-input v-model="form.lng" placeholder="请输入纬度"/>
        </el-form-item>
        <el-form-item label="停车信息" prop="parkCarInfo">
          <el-input v-model="form.parkCarInfo" placeholder="请输入停车信息"/>
        </el-form-item>
        <el-form-item label="站点图片" prop="fileId">
          <image-upload v-model="form.fileId"/>
        </el-form-item>
        <el-form-item label="平台类型" prop="deviceType">
          <el-select v-model="form.deviceType" placeholder="请选择平台类型">
            <el-option
              v-for="dict in dict.type.device_type"
              :key="dict.value"
              :label="dict.label"
              :value="parseInt(dict.value)"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="开票信息" prop="receiptStatus">
          <el-radio-group v-model="form.receiptStatus">
            <el-radio
              v-for="dict in dict.type.plot_receipt_status"
              :key="dict.value"
              :label="dict.value"
            >{{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="配套设施" prop="supportingFacilities">
          <el-checkbox-group v-model="form.supportingFacilities">
            <el-checkbox
              v-for="dict in dict.type.plot_supporting_facilities"
              :key="dict.value"
              :label="dict.value">
              {{ dict.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="停车费" prop="parkCarStatus">
          <el-radio-group v-model="form.parkCarStatus">
            <el-radio
              v-for="dict in dict.type.plot_park_car_status"
              :key="dict.value"
              :label="dict.value"
            >{{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {listStation, getStation, delStation, addStation, updateStation} from "@/api/operator/station";
import {parseTime} from "@/utils/hcp";

export default {
  name: "Station",
  dicts: ['plot_supporting_facilities', 'sys_yes_no', 'device_type', 'plot_park_car_status', 'plot_receipt_status'],
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
      // 站点表格数据
      stationList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        stationName: null,
        address: null,
        regionCode: null,
        deviceType: null,
        isHlht: null,
        hlhtId: null,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        stationName: [
          {required: true, message: "站点名称不能为空", trigger: "blur"}
        ],
        address: [
          {required: true, message: "地址不能为空", trigger: "blur"}
        ],
        regionCode: [
          {required: true, message: "所属地区代码不能为空", trigger: "blur"}
        ],
      }
    };
  },
  created() {
    this.getList();
  },
  methods: {
    /** 查询站点列表 */
    getList() {
      this.loading = true;
      listStation(this.queryParams).then(response => {
        this.stationList = response.data;
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
        stationId: null,
        stationCode: null,
        stationName: null,
        address: null,
        regionCode: null,
        userId: null,
        createTime: null,
        lat: null,
        lng: null,
        parkCarInfo: null,
        fileId: null,
        updateTime: null,
        deviceType: null,
        delFlag: null,
        receiptStatus: "0",
        supportingFacilities: [],
        parkCarStatus: "0",
        province: null,
        city: null,
        area: null,
        isHlht: 0,
        hlhtId: null,
        tenantId: null
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
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map(item => item.stationId)
      this.single = selection.length !== 1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset();
      this.open = true;
      this.title = "添加站点";
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const stationId = row.stationId || this.ids
      getStation(stationId).then(response => {
        this.form = response.data;
        this.form.supportingFacilities = this.form.supportingFacilities.split(",");
        this.open = true;
        this.title = "修改站点";
      });
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          this.form.supportingFacilities = this.form.supportingFacilities.join(",");
          if (this.form.stationId != null) {
            updateStation(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addStation(this.form).then(response => {
              this.$modal.msgSuccess("新增成功");
              this.open = false;
              this.getList();
            });
          }
        }
      });
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const stationIds = row.stationId || this.ids;
      this.$modal.confirm('是否确认删除当前站点数据项？').then(function () {
        return delStation(stationIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('operator/station/export', {
        ...this.queryParams
      }, `站点_${parseTime(new Date().getTime(), '{y}-{m}-{d}')}.xlsx`)
    }
  }
};
</script>
