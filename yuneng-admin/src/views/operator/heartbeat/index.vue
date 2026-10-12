<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="充电桩ID" prop="pileId">
        <el-input
          v-model="queryParams.pileId"
          placeholder="请输入充电桩ID"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="充电桩端口" prop="deviceId">
        <el-input
          v-model="queryParams.deviceId"
          placeholder="请输入充电桩端口"
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
          v-hasPermi="['operator:heartbeat:add']"
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
          v-hasPermi="['operator:heartbeat:edit']"
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
          v-hasPermi="['operator:heartbeat:remove']"
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
          v-hasPermi="['operator:heartbeat:export']"
        >导出
        </el-button>
      </el-col>
      <right-toolbar :showSearch.sync="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="heartbeatList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center"/>
      <el-table-column label="充电桩ID" align="center" prop="pileId"/>
      <el-table-column label="充电桩端口" align="center" prop="deviceId"/>
      <el-table-column label="端口状态" align="center" prop="chargestate">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charging_status" :value="scope.row.chargestate"/>
        </template>
      </el-table-column>
      <el-table-column label="源数据" align="center" prop="sourcemsg"/>
      <el-table-column label="消息来源" align="center" prop="msgType"/>
      <el-table-column label="创建时间" align="center" prop="createtime" width="180">
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.createtime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['operator:heartbeat:edit']"
          >修改
          </el-button>
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['operator:heartbeat:remove']"
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

    <!-- 添加或修改充电桩心跳数据对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="500px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="充电桩ID" prop="pileId">
          <el-input v-model="form.pileId" placeholder="请输入充电桩ID"/>
        </el-form-item>
        <el-form-item label="充电桩端口" prop="deviceId">
          <el-input v-model="form.deviceId" placeholder="请输入充电桩端口"/>
        </el-form-item>
        <el-form-item label="端口状态" prop="chargestate">
          <el-radio-group v-model="form.chargestate">
            <el-radio
              v-for="dict in dict.type.charging_status"
              :key="dict.value"
              :label="dict.value"
            >{{ dict.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="源数据" prop="sourcemsg">
          <el-input v-model="form.sourcemsg" type="textarea" placeholder="请输入内容"/>
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
import {listHeartbeat, getHeartbeat, delHeartbeat, addHeartbeat, updateHeartbeat} from "@/api/operator/heartbeat";
import {parseTime} from "@/utils/hcp";

export default {
  name: "Heartbeat",
  dicts: ['charging_status'],
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
      // 充电桩心跳数据表格数据
      heartbeatList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        pileId: null,
        deviceId: null,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {}
    };
  },
  created() {
    this.getList();
  },
  methods: {
    /** 查询充电桩心跳数据列表 */
    getList() {
      this.loading = true;
      listHeartbeat(this.queryParams).then(response => {
        this.heartbeatList = response.data;
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
        deviceId: null,
        chargestate: "0",
        sourcemsg: null,
        msgType: null,
        createtime: null
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
      this.open = true;
      this.title = "添加充电桩心跳数据";
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const pileId = row.pileId || this.ids
      getHeartbeat(pileId).then(response => {
        this.form = response.data;
        this.open = true;
        this.title = "修改充电桩心跳数据";
      });
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.form.pileId != null) {
            updateHeartbeat(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addHeartbeat(this.form).then(response => {
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
      this.$modal.confirm('是否确认删除当前充电桩心跳数据数据项？').then(function () {
        return delHeartbeat(pileIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('operator/heartbeat/export', {
        ...this.queryParams
      }, `充电桩心跳数据_${parseTime(new Date().getTime(), '{y}-{m}-{d}')}.xlsx`)
    }
  }
};
</script>
