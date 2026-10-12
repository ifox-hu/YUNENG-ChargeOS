<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="编号" prop="pileId">
        <el-input
          v-model="queryParams.pileId"
          placeholder="请输入编号"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input
          v-model="queryParams.name"
          placeholder="请输入名称"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="收费类型" prop="cpFeeType">
        <el-select v-model="queryParams.cpFeeType" placeholder="请选择收费类型" clearable>
          <el-option
            v-for="dict in dict.type.charging_is_free"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="设备类型" prop="deviceType">
        <el-select v-model="queryParams.deviceType" placeholder="请选择设备类型" clearable>
          <el-option
            v-for="dict in dict.type.device_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="桩类型" prop="pileType">
        <el-select v-model="queryParams.pileType" placeholder="请选择充电桩类型" clearable>
          <el-option
            v-for="dict in dict.type.pile_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="设备状态" prop="pileStatus">
        <el-select v-model="queryParams.pileStatus" placeholder="请选择设备状态" clearable>
          <el-option
            v-for="dict in dict.type.pile_status"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
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
          v-hasPermi="['operator:pile:add']"
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
          v-hasPermi="['operator:pile:edit']"
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
          v-hasPermi="['operator:pile:remove']"
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
          v-hasPermi="['operator:pile:export']"
        >导出
        </el-button>
      </el-col>
      <right-toolbar :showSearch.sync="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="pileList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center"/>
      <el-table-column label="编号" align="center" prop="pileId"/>
      <el-table-column label="名称" align="center" prop="name"/>
      <el-table-column label="收费类型" align="center" prop="cpFeeType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charging_is_free" :value="scope.row.cpFeeType"/>
        </template>
      </el-table-column>
      <el-table-column label="运行状态" align="center" prop="runningStatus">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.pile_running_status" :value="scope.row.runningStatus"/>
        </template>
      </el-table-column>
      <el-table-column label="离线时间" align="center" prop="offlineTime" width="180">
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.offlineTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="代理商ID" align="center" prop="userId"/>
      <el-table-column label="设备类型" align="center" prop="deviceType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.device_type" :value="scope.row.deviceType"/>
        </template>
      </el-table-column>
      <el-table-column label="充电桩类型" align="center" prop="pileType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.pile_type" :value="scope.row.pileType"/>
        </template>
      </el-table-column>
      <el-table-column label="设备状态" align="center" prop="pileStatus">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.pile_status" :value="scope.row.pileStatus"/>
        </template>
      </el-table-column>
      <el-table-column label="电流信息" align="center" prop="electricity"/>
      <el-table-column label="电压信息" align="center" prop="voltage"/>
      <el-table-column label="最大功率" align="center" prop="maxPower"/>
      <el-table-column label="更新收费规则" align="center" prop="feeNeedUpdate">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.hcp_yes_no" :value="scope.row.feeNeedUpdate"/>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['operator:pile:edit']"
          >修改
          </el-button>
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['operator:pile:remove']"
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

    <!-- 添加或修改充电桩对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="800px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="编号" prop="pileId">
          <el-input v-model="form.pileId" placeholder="请输入桩编号"/>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称"/>
        </el-form-item>
        <el-form-item label="收费类型" prop="cpFeeType">
          <el-radio-group v-model="form.cpFeeType">
            <el-radio
              v-for="dict in dict.type.charging_is_free"
              :key="dict.value"
              :label="dict.value"
            >{{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="站点ID" prop="stationId">
          <el-input v-model="form.stationId" placeholder="请输入站点ID"/>
        </el-form-item>
        <el-form-item label="计费规则规则" prop="wxRuleId">
          <el-input v-model="form.wxRuleId" placeholder="请输入微信公众号支付规则ID"/>
        </el-form-item>
        <el-form-item label="设备类型" prop="deviceType">
          <el-radio-group v-model="form.deviceType">
            <el-radio
              v-for="dict in dict.type.device_type"
              :key="dict.value"
              :label="parseInt(dict.value)"
            >{{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="充电桩类型" prop="pileType">
          <el-radio-group v-model="form.pileType">
            <el-radio
              v-for="dict in dict.type.pile_type"
              :key="dict.value"
              :label="parseInt(dict.value)"
            >{{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="电流信息" prop="electricity">
          <el-input v-model="form.electricity" placeholder="请输入电流信息"/>
        </el-form-item>
        <el-form-item label="电压信息" prop="voltage">
          <el-input v-model="form.voltage" placeholder="请输入电压信息"/>
        </el-form-item>
        <el-form-item label="最大功率" prop="maxPower">
          <el-input v-model="form.maxPower" placeholder="请输入最大功率"/>
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
import {listPile, getPile, delPile, addPile, updatePile} from "@/api/operator/pile";
import {parseTime} from "@/utils/hcp";

export default {
  name: "Pile",
  dicts: ['pile_type', 'charging_is_free', 'hcp_yes_no', 'device_type', 'pile_running_status', 'pile_status'],
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
      // 充电桩表格数据
      pileList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      editMode: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        pileId: null,
        name: null,
        cpFeeType: null,
        userId: null,
        deviceType: null,
        pileType: null,
        pileStatus: null,
        feeNeedUpdate: null,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        pileId: [
          {required: true, message: "请输入桩编码", trigger: "blur"}
        ],
        name: [
          {required: true, message: "请输入桩名称", trigger: "blur"}
        ],
        cpFeeType: [
          {required: true, message: "收费类型不能为空", trigger: "change"}
        ],
        deviceType: [
          {required: true, message: "设备类型不能为空", trigger: "change"}
        ],
        pileType: [
          {required: true, message: "充电桩类型不能为空", trigger: "change"}
        ],
        pileStatus: [
          {required: true, message: "设备状态不能为空", trigger: "change"}
        ],
        feeNeedUpdate: [
          {required: true, message: "更新收费规则不能为空", trigger: "change"}
        ],
      }
    };
  },
  created() {
    this.getList();
  },
  methods: {
    /** 查询充电桩列表 */
    getList() {
      this.loading = true;
      listPile(this.queryParams).then(response => {
        this.pileList = response.data;
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
        pileId: null,
        name: null,
        cpFeeType: "0",
        simCard: null,
        simDueTime: null,
        equipTemperature: null,
        equipCpuTemperature: null,
        lat: null,
        lng: null,
        address: null,
        imgUrl: null,
        runningStatus: 0,
        offlineTime: null,
        userId: null,
        lastUseTime: null,
        stationId: null,
        wxRuleId: null,
        cardRuleId: null,
        createTime: null,
        deviceType: 0,
        pileType: 0,
        pileStatus: 0,
        electricity: null,
        voltage: null,
        maxPower: null,
        feeNeedUpdate: 0,
        apiVersion: null,
        updateTime: null,
        remark: null,
        deleted: null,
        isHlht: 0,
        hlhtId: null,
        tenantId: null,
        editMode: false
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
      this.ids = selection.map(item => item.pileId)
      this.single = selection.length !== 1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset();
      this.editMode = false
      this.open = true;
      this.title = "添加充电桩";
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const pileId = row.pileId || this.ids
      this.editMode = true
      getPile(pileId).then(response => {
        this.form = response.data;
        this.open = true;
        this.title = "修改充电桩";
      });
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.editMode) {
            updatePile(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addPile(this.form).then(response => {
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
      const pileIds = row.pileId || this.ids;
      this.$modal.confirm('是否确认删除当前充电桩数据项？').then(function () {
        return delPile(pileIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('operator/pile/export', {
        ...this.queryParams
      }, `充电桩_${parseTime(new Date().getTime(), '{y}-{m}-{d}')}.xlsx`)
    }
  }
};
</script>
