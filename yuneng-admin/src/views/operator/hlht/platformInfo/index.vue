<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
                  <el-form-item label="" prop="platformId">
                    <el-input
                        v-model="queryParams.platformId"
                        placeholder="对接编码"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>
                  <el-form-item label="" prop="platformName">
                    <el-input
                        v-model="queryParams.platformName"
                        placeholder="对接平台名称"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>
                  <el-form-item label="" prop="contactPerson">
                    <el-input
                        v-model="queryParams.contactPerson"
                        placeholder="对接人姓名"
                        clearable
                        @keyup.enter.native="handleQuery"
                    />
                  </el-form-item>

      <el-form-item label="" prop="pushEnable">
        <el-select clearable v-model="queryParams.pushEnable" placeholder="是否推送">
          <el-option
            v-for="dict in dict.type.hlht_operator_push"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          ></el-option>
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
          type="primary"
          icon="el-icon-plus"
          @click="handleAdd"
        >新增
        </el-button>
      </el-form-item>
    </el-form>


    <el-table v-loading="loading" :data="platformInfoList">
              <el-table-column label="对接编码" align="center" prop="platformId" />
              <el-table-column label="对接平台名称" align="center" prop="platformName" />
              <el-table-column label="对接人姓名" align="center" prop="contactPerson" />
              <el-table-column label="对接人联系方式" align="center" prop="mobile" />
              <el-table-column label="对接方秘钥" align="center" prop="platformSecretOrigin" />
<!--              <el-table-column label="对接方秘钥(加密)" align="center" prop="platformSecret" />-->
              <el-table-column label="签名秘钥" align="center" prop="signSecret" />
              <el-table-column label="数据加密秘钥" align="center" prop="dataSecret" />
              <el-table-column label="初始化向量" align="center" prop="dataSecretIv" />
              <el-table-column label="互联互通地址" align="center" prop="apiUrl" />
              <el-table-column label="服务器IP" align="center" prop="accessIp" />
              <el-table-column label="对接环境" align="center" prop="env" />
              <el-table-column label="我方平台ID" align="center" prop="jingliPlatformId" />
              <el-table-column label="我放平台key" align="center" prop="jingliPlatformSecret" />
              <el-table-column label="我方签名密钥" align="center" prop="jingliSigSecret" />
              <el-table-column label="我方数据加密密钥" align="center" prop="jingliDataSecret" />
              <el-table-column label="我方初始化向量" align="center" prop="jingliDataSecretIv" />
              <el-table-column label="是否推送" align="center" prop="pushEnable">
                <template slot-scope="scope">
                  <dict-tag :options="dict.type.hlht_operator_push" :value="scope.row.pushEnable"/>
                </template>
              </el-table-column>

      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <div class="editCell">
            <el-button type="primary" @click="editCardHandler(scope.row)">编辑</el-button>
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

    <!-- 添加或修改平台信息对话框 -->

    <el-dialog :title="title" :visible.sync="dialogVisible" width="80%">
      <el-form ref="formData" :inline="true" :model="formData" label-width="150px" :rules="formRule">
        <el-form-item class="nav-form-item" label="对接编码 " prop="platformId">
          <el-input v-model="formData.platformId" style="width:300px;" placeholder="请输入对接编码" clearable maxlength="100"
                    show-word-limit />
        </el-form-item>
        <el-form-item class="nav-form-item" label="对接平台名称" prop="platformName">
          <el-input v-model="formData.platformName" style="width:300px;" placeholder="请输入对接平台名称" maxlength="50"
                    show-word-limit />
        </el-form-item>
        <el-form-item class="nav-form-item" label="对接人姓名" prop="contactPerson">
          <el-input maxlength="50" v-model="formData.contactPerson" style="width:300px;" placeholder="请输入对接人姓名" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="对接人联系方式" prop="mobile">
          <el-input maxlength="11" v-model="formData.mobile" style="width:300px;" placeholder="请输入对接人联系方式" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="对接方秘钥" prop="platformSecretOrigin">
          <el-input maxlength="11" v-model="formData.platformSecretOrigin" style="width:300px;" placeholder="请输入对接方秘钥" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="签名秘钥" prop="signSecret">
          <el-input maxlength="50" v-model="formData.signSecret" style="width:300px;" placeholder="请输入签名秘钥" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="数据加密秘钥" prop="dataSecret">
          <el-input maxlength="50" v-model="formData.dataSecret" style="width:300px;" placeholder="请输入数据加密秘钥" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="初始化向量" prop="dataSecretIv">
          <el-input maxlength="50" v-model="formData.dataSecretIv" style="width:300px;" placeholder="请输入初始化向量" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="接口地址" prop="apiUrl">
          <el-input maxlength="50" v-model="formData.apiUrl" style="width:300px;" placeholder="请输入接口地址" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="服务器IP" prop="accessIp">
          <el-input maxlength="50" v-model="formData.accessIp" style="width:300px;" placeholder="请输入服务器IP" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="对接环境" prop="env">
          <el-input maxlength="50" v-model="formData.env" style="width:300px;" placeholder="请输入对接环境" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="我方平台ID" prop="jingliPlatformId">
          <el-input maxlength="50" v-model="formData.jingliPlatformId" style="width:300px;" placeholder="请输入我方平台ID" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="我放平台key" prop="jingliPlatformSecret">
          <el-input maxlength="50" v-model="formData.jingliPlatformSecret" style="width:300px;" placeholder="请输入我放平台key" />
        </el-form-item><el-form-item class="nav-form-item" label="我方签名密钥" prop="jingliSigSecret">
        <el-input maxlength="50" v-model="formData.jingliSigSecret" style="width:300px;" placeholder="请输入我方签名密钥" />
      </el-form-item>
        <el-form-item class="nav-form-item" label="我方数据加密密钥" prop="jingliDataSecret">
          <el-input maxlength="50" v-model="formData.jingliDataSecret" style="width:300px;" placeholder="请输入我方数据加密密钥" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="我方初始化向量" prop="jingliDataSecretIv">
          <el-input maxlength="50" v-model="formData.jingliDataSecretIv" style="width:300px;" placeholder="请输入我方初始化向量" />
        </el-form-item>
        <el-form-item class="nav-form-item" label="是否推送" prop="pushEnable">
          <el-radio-group style="width:300px;" v-model="formData.pushEnable">
            <el-radio :label="0">不推送</el-radio>
            <el-radio :label="1">推送</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item class="nav-form-item" label="验证密钥" prop="pushEnable">
          <el-radio-group style="width:300px;" v-model="formData.useSecret">
            <el-radio :label="0">我放密钥</el-radio>
            <el-radio :label="1">对方密钥</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="confimHandler(formData)">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
  import { listPlatformInfo, getPlatformInfo, delPlatformInfo, addPlatformInfo, updatePlatformInfo } from "@/api/operator/platformInfo";
  import {parseTime} from "@/utils/hcp";

  export default {
    name: "PlatformInfo",
    dicts:['hlht_operator_push'],
    data() {
      return {
        // 遮罩层
        loading: true,
        dateRange:[],
        dialogVisible: false,
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
        // 平台信息表格数据
              platformInfoList: [],
        // 弹出层标题
        title: "",
        // 是否显示弹出层
        open: false,
        // 查询参数
        queryParams: {
          pageNum: 1,
          pageSize: 10,
                        platformId: null,
                        platformName: null,
                        contactPerson: null,
                        mobile: null,
                        platformSecretOrigin: null,
                        platformSecret: null,
                        signSecret: null,
                        dataSecret: null,
                        dataSecretIv: null,
                        apiUrl: null,
                        accessIp: null,
                        env: null,
                        jingliPlatformId: null,
                        jingliPlatformSecret: null,
                        jingliSigSecret: null,
                        jingliDataSecret: null,
                        jingliDataSecretIv: null,
                        pushEnable: null,
        },
        // 表单参数
        formData: {},
        // 表单校验

        formRule: {
          platformId: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          platformName: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          contactPerson: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          mobile: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          platformSecretOrigin: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          signSecret: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          dataSecret: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          dataSecretIv: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          apiUrl: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          accessIp: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          env: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          jingliPlatformId: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          jingliPlatformSecret: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          jingliSigSecret: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          jingliDataSecret: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          jingliDataSecretIv: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          pushEnable: [{ required: true, message: "请输入必填项", trigger: "blur" }],
          useSecret: [{ required: true, message: "请输入必填项", trigger: "blur" }],
        },
      };
    },
    created() {
      this.getList();
    },
    methods: {
      /** 查询平台信息列表 */
      getList() {
        this.loading = true;

        this.dateRange = Array.isArray(this.dateRange) ? this.dateRange : [];

        this.queryParams.startTime=this.dateRange[0];
        this.queryParams.endTime=this.dateRange[1];
        listPlatformInfo(this.queryParams).then(response => {
          this.platformInfoList = response.data;
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
                        id: null,
                        platformId: null,
                        platformName: null,
                        contactPerson: null,
                        mobile: null,
                        platformSecretOrigin: null,
                        platformSecret: null,
                        signSecret: null,
                        dataSecret: null,
                        dataSecretIv: null,
                        apiUrl: null,
                        accessIp: null,
                        env: null,
                        jingliPlatformId: null,
                        jingliPlatformSecret: null,
                        jingliSigSecret: null,
                        jingliDataSecret: null,
                        jingliDataSecretIv: null,
                        pushEnable: null,
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
        this.ids = selection.map(item => item.id)
        this.single = selection.length!==1
        this.multiple = !selection.length
      },
      /** 新增按钮操作 */
      handleAdd() {
        this.reset();
        this.title = "添加平台信息";
        this.isAdd = true;
        this.formData = {}
        this.dialogVisible = true;
      },
      /** 修改按钮操作 */
      handleUpdate(row) {
        this.reset();
        const id = row.id || this.ids
        getPlatformInfo(id).then(response => {
          this.form = response.data;
          this.open = true;
          this.title = "修改平台信息";
        });
      },
      /** 提交按钮 */
      submitForm() {
        this.$refs["form"].validate(valid => {
          if (valid) {
            if (this.form.id != null) {
              updatePlatformInfo(this.form).then(response => {
                this.$modal.msgSuccess("修改成功");
                this.open = false;
                this.getList();
              });
            } else {
              addPlatformInfo(this.form).then(response => {
                this.$modal.msgSuccess("新增成功");
                this.open = false;
                this.getList();
              });
            }
          }
        });
      },
      confimHandler() {
        this.$refs.formData.validate((valid) => {
          if (valid) {
            this.addCard()
          }
        });
      },
      addCard() {
        addPlatformInfo(this.formData).then((res) => {
          if (res.code == -1) {
            this.$message.error(res.data);
          } else {
            this.formData = {}
            this.$message({
              message: "操作成功",
              type: "success",
            });
            this.dialogVisible = false;
            this.getList();
          }
        });
      },

      editCardHandler(row) {
        this.isAdd = false;
        this.formData.id = row.id
        this.formData.platformId = row.platformId;
        this.formData.platformName = row.platformName;
        this.formData.contactPerson = row.contactPerson;
        this.formData.mobile = row.mobile;
        this.formData.platformSecretOrigin = row.platformSecretOrigin;
        this.formData.signSecret = row.signSecret;
        this.formData.dataSecret = row.dataSecret;
        this.formData.dataSecretIv = row.dataSecretIv;
        this.formData.apiUrl = row.apiUrl;
        this.formData.accessIp = row.accessIp;
        this.formData.env = row.env;
        this.formData.jingliPlatformId = row.jingliPlatformId;
        this.formData.jingliPlatformSecret = row.jingliPlatformSecret;
        this.formData.jingliSigSecret = row.jingliSigSecret;
        this.formData.jingliDataSecret = row.jingliDataSecret;
        this.formData.jingliDataSecretIv = row.jingliDataSecretIv;
        this.formData.pushEnable = row.pushEnable;
        this.formData.useSecret = row.useSecret
        this.title = "编辑";
        this.dialogVisible = true;
      },
   }
  };
</script>
