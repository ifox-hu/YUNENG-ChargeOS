<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="120px">
      <el-form-item label="小程序appid" prop="appId">
        <el-input
          v-model="queryParams.appId"
          placeholder="请输入小程序appid"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="小程序名" prop="name">
        <el-input
          v-model="queryParams.name"
          placeholder="请输入小程序名称"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="商户号" prop="mchId">
        <el-input
          v-model="queryParams.mchId"
          placeholder="请输入商户号"
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
          v-hasPermi="['mp:miniapp:add']"
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
          v-hasPermi="['mp:miniapp:edit']"
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
          v-hasPermi="['mp:miniapp:remove']"
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
          v-hasPermi="['mp:miniapp:export']"
        >导出
        </el-button>
      </el-col>
      <right-toolbar :showSearch.sync="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="miniappList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center"/>
      <el-table-column label="小程序appid" align="center" prop="appId"/>
      <el-table-column label="小程序名称" align="center" prop="name"/>
      <el-table-column label="小程序图标" align="center" prop="logo" width="100">
        <template slot-scope="scope">
          <image-preview :src="scope.row.logo" :width="50" :height="50"/>
        </template>
      </el-table-column>
      <el-table-column label="小程序secret" align="center" prop="appSecret"/>
      <el-table-column label="商户号" align="center" prop="mchId"/>
      <el-table-column label="商户密钥" align="center" prop="mchKey"/>
      <el-table-column label="证书路径" align="center" prop="keyPath"/>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['mp:miniapp:edit']"
          >修改
          </el-button>
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['mp:miniapp:remove']"
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

    <!-- 添加或修改小程序对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="800px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="小程序名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入小程序名称"/>
        </el-form-item>
        <el-form-item label="小程序图标" prop="logo">
          <image-upload v-model="form.logo"/>
        </el-form-item>
        <el-form-item label="小程序appId" prop="appId">
          <el-input v-model="form.appId" placeholder="小程序appId"/>
        </el-form-item>
        <el-form-item label="小程序secret" prop="appSecret">
          <el-input v-model="form.appSecret" placeholder="请输入小程序secret"/>
        </el-form-item>
        <el-form-item label="商户号" prop="mchId">
          <el-input v-model="form.mchId" placeholder="请输入商户号"/>
        </el-form-item>
        <el-form-item label="商户密钥" prop="mchKey">
          <el-input v-model="form.mchKey" placeholder="请输入商户密钥"/>
        </el-form-item>
        <el-form-item label="证书路径" prop="keyPath">
          <file-upload v-model="form.keyPath"/>
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
import {listMiniapp, getMiniapp, delMiniapp, addMiniapp, updateMiniapp} from "@/api/mp/miniapp";
import {parseTime} from "@/utils/hcp";

export default {
  name: "Miniapp",
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
      // 小程序表格数据
      miniappList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      editFlag: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        appId: null,
        name: null,
        logo: null,
        appSecret: null,
        mchId: null,
        mchKey: null,
        keyPath: null,
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
    /** 查询小程序列表 */
    getList() {
      this.loading = true;
      listMiniapp(this.queryParams).then(response => {
        this.miniappList = response.data;
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
        appId: null,
        name: null,
        logo: null,
        appSecret: null,
        mchId: null,
        mchKey: null,
        keyPath: null,
        createTime: null,
        createBy: null,
        updateTime: null,
        updateBy: null,
        status: "0",
        delFlag: null,
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
      this.ids = selection.map(item => item.appId)
      this.single = selection.length !== 1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset();
      this.open = true;
      this.editFlag = false
      this.title = "添加小程序";
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const appId = row.appId || this.ids
      getMiniapp(appId).then(response => {
        this.form = response.data;
        this.open = true;
        this.editFlag = true
        this.title = "修改小程序";
      });
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.editFlag) {
            updateMiniapp(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addMiniapp(this.form).then(response => {
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
      const appIds = row.appId || this.ids;
      this.$modal.confirm('是否确认删除当前小程序数据项？').then(function () {
        return delMiniapp(appIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('mp/miniapp/export', {
        ...this.queryParams
      }, `小程序_${parseTime(new Date().getTime(), '{y}-{m}-{d}')}.xlsx`)
    }
  }
};
</script>
