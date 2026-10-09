<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
                  <el-form-item label="" prop="operatorName">
                    <el-input
                        v-model="queryParams.operatorName"
                        placeholder="运营商全称"
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



    <el-table v-loading="loading" :data="operatorInfoList">
              <el-table-column label="组织机构代码" align="center" prop="operatorId" />
              <el-table-column label="运营商统一社会
信用代码" align="center" prop="operatorUcsId" />
              <el-table-column label="运营商全称" align="center" prop="operatorName" />
              <el-table-column label="运营商客服电话" align="center" prop="operatorTel1" />
              <el-table-column label="运营商客服电话" align="center" prop="operatorTel2" />
              <el-table-column label="运营商注册地址" align="center" prop="operatorRegAddress" />
              <el-table-column label="备注信息" align="center" prop="operatorNote" />
              <el-table-column label="用户ID" align="center" prop="userId" />
              <el-table-column label="是否推送" align="center" prop="isPush" />

    </el-table>

    <pagination
        v-show="total>0"
        :total="total"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        @pagination="getList"
    />

    <!-- 添加或修改运营商信息对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="500px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="80px">
                        <el-form-item label="运营商统一社会
信用代码" prop="operatorUcsId">
                          <el-input v-model="form.operatorUcsId" placeholder="请输入运营商统一社会
信用代码" />
                        </el-form-item>
                        <el-form-item label="运营商全称" prop="operatorName">
                          <el-input v-model="form.operatorName" placeholder="请输入运营商全称" />
                        </el-form-item>
                        <el-form-item label="运营商客服电话" prop="operatorTel1">
                          <el-input v-model="form.operatorTel1" placeholder="请输入运营商客服电话" />
                        </el-form-item>
                        <el-form-item label="运营商客服电话" prop="operatorTel2">
                          <el-input v-model="form.operatorTel2" placeholder="请输入运营商客服电话" />
                        </el-form-item>
                        <el-form-item label="运营商注册地址" prop="operatorRegAddress">
                          <el-input v-model="form.operatorRegAddress" placeholder="请输入运营商注册地址" />
                        </el-form-item>
                        <el-form-item label="备注信息" prop="operatorNote">
                          <el-input v-model="form.operatorNote" placeholder="请输入备注信息" />
                        </el-form-item>
                        <el-form-item label="用户ID" prop="userId">
                          <el-input v-model="form.userId" placeholder="请输入用户ID" />
                        </el-form-item>
                        <el-form-item label="是否推送0未推送1推送" prop="isPush">
                          <el-input v-model="form.isPush" placeholder="请输入是否推送0未推送1推送" />
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
  import { listOperatorInfo, getOperatorInfo, delOperatorInfo, addOperatorInfo, updateOperatorInfo } from "@/api/operator/operatorInfo";
  import {parseTime} from "@/utils/hcp";

  export default {
    name: "OperatorInfo",
    data() {
      return {
        // 遮罩层
        loading: true,
        dateRange:[],
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
        // 运营商信息表格数据
              operatorInfoList: [],
        // 弹出层标题
        title: "",
        // 是否显示弹出层
        open: false,
        // 查询参数
        queryParams: {
          pageNum: 1,
          pageSize: 10,
                        operatorName: null,
                        createTime: null
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
      /** 查询运营商信息列表 */
      getList() {
        this.loading = true;
        this.dateRange = Array.isArray(this.dateRange) ? this.dateRange : [];

        this.queryParams.startTime=this.dateRange[0];
        this.queryParams.endTime=this.dateRange[1];
        listOperatorInfo(this.queryParams).then(response => {
          this.operatorInfoList = response.data;
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
                        operatorId: null,
                        operatorUcsId: null,
                        operatorName: null,
                        operatorTel1: null,
                        operatorTel2: null,
                        operatorRegAddress: null,
                        operatorNote: null,
                        userId: null,
                        isPush: null,
                        createTime: null
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
        this.ids = selection.map(item => item.operatorId)
        this.single = selection.length!==1
        this.multiple = !selection.length
      },
      /** 新增按钮操作 */
      handleAdd() {
        this.reset();
        this.open = true;
        this.title = "添加运营商信息";
      },
      /** 修改按钮操作 */
      handleUpdate(row) {
        this.reset();
        const operatorId = row.operatorId || this.ids
        getOperatorInfo(operatorId).then(response => {
          this.form = response.data;
          this.open = true;
          this.title = "修改运营商信息";
        });
      },
      /** 提交按钮 */
      submitForm() {
        this.$refs["form"].validate(valid => {
          if (valid) {
            if (this.form.operatorId != null) {
              updateOperatorInfo(this.form).then(response => {
                this.$modal.msgSuccess("修改成功");
                this.open = false;
                this.getList();
              });
            } else {
              addOperatorInfo(this.form).then(response => {
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
        const operatorIds = row.operatorId || this.ids;
        this.$modal.confirm('是否确认删除当前运营商信息数据项？').then(function() {
          return delOperatorInfo(operatorIds);
        }).then(() => {
          this.getList();
          this.$modal.msgSuccess("删除成功");
        }).catch(() => {});
      },
      /** 导出按钮操作 */
      handleExport() {
        this.download('operator/operatorInfo/export', {
            ...this.queryParams
        }, `运营商信息_${parseTime(new Date().getTime(), '{y}-{m}-{d}') }.xlsx`)
      }
   }
  };
</script>
