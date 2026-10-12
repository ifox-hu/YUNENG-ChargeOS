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
      <el-form-item label="规则ID" prop="ruleId">
        <el-input
          v-model="queryParams.ruleId"
          placeholder="请输入规则ID"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="服务费用" prop="servicePrice">
        <el-input
          v-model="queryParams.servicePrice"
          placeholder="请输入服务费用"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="电费类型" prop="priceType">
        <el-select v-model="queryParams.priceType" placeholder="请选择电费类型" clearable>
          <el-option
            v-for="dict in dict.type.price_type"
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
          v-hasPermi="['operator:price:add']"
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
          v-hasPermi="['operator:price:edit']"
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
          v-hasPermi="['operator:price:remove']"
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
          v-hasPermi="['operator:price:export']"
        >导出
        </el-button>
      </el-col>
      <right-toolbar :showSearch.sync="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="priceList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center"/>
      <el-table-column label="主键" align="center" prop="priceId"/>
      <el-table-column label="计费类型" align="center" prop="chargeType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.charge_type" :value="scope.row.chargeType"/>
        </template>
      </el-table-column>
      <el-table-column label="电费" align="center" prop="price"/>
      <el-table-column label="充电桩ID" align="center" prop="pileId"/>
      <el-table-column label="规则ID" align="center" prop="ruleId"/>
      <el-table-column label="服务费用" align="center" prop="servicePrice"/>
      <el-table-column label="创建时间" align="center" prop="createtime" width="180">
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.createtime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="电费类型" align="center" prop="priceType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.price_type" :value="scope.row.priceType"/>
        </template>
      </el-table-column>
      <el-table-column label="时间范围" align="center" prop="rangTime"/>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['operator:price:edit']"
          >修改
          </el-button>
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['operator:price:remove']"
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

    <!-- 添加或修改价格对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="500px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="计费类型" prop="chargeType">
          <el-select v-model="form.chargeType" placeholder="请选择计费类型">
            <el-option
              v-for="dict in dict.type.charge_type"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="时长" prop="time">
          <el-input v-model="form.time" placeholder="请输入时长"/>
        </el-form-item>
        <el-form-item label="电费" prop="price">
          <el-input v-model="form.price" placeholder="请输入电费"/>
        </el-form-item>
        <el-form-item label="每小时" prop="hours">
          <el-input v-model="form.hours" placeholder="请输入每小时"/>
        </el-form-item>
        <el-form-item label="授权数量" prop="granternum">
          <el-input v-model="form.granternum" placeholder="请输入授权数量"/>
        </el-form-item>
        <el-form-item label="授权加个" prop="granterprice">
          <el-input v-model="form.granterprice" placeholder="请输入授权加个"/>
        </el-form-item>
        <el-form-item label="充电桩ID" prop="pileId">
          <el-input v-model="form.pileId" placeholder="请输入充电桩ID"/>
        </el-form-item>
        <el-form-item label="规则ID" prop="ruleId">
          <el-input v-model="form.ruleId" placeholder="请输入规则ID"/>
        </el-form-item>
        <el-form-item label="删除标记" prop="delFlag">
          <el-input v-model="form.delFlag" placeholder="请输入删除标记"/>
        </el-form-item>
        <el-form-item label="服务费用" prop="servicePrice">
          <el-input v-model="form.servicePrice" placeholder="请输入服务费用"/>
        </el-form-item>
        <el-form-item label="最小瓦数" prop="minWatt">
          <el-input v-model="form.minWatt" placeholder="请输入最小瓦数"/>
        </el-form-item>
        <el-form-item label="最大瓦数" prop="maxWatt">
          <el-input v-model="form.maxWatt" placeholder="请输入最大瓦数"/>
        </el-form-item>
        <el-form-item label="电费类型" prop="priceType">
          <el-select v-model="form.priceType" placeholder="请选择电费类型">
            <el-option
              v-for="dict in dict.type.price_type"
              :key="dict.value"
              :label="dict.label"
              :value="parseInt(dict.value)"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围" prop="rangTime">
          <el-input v-model="form.rangTime" placeholder="请输入时间范围"/>
        </el-form-item>
        <el-form-item label="租户编号" prop="tenantId">
          <el-input v-model="form.tenantId" placeholder="请输入租户编号"/>
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
import {listPrice, getPrice, delPrice, addPrice, updatePrice} from "@/api/operator/price";
import {parseTime} from "@/utils/hcp";

export default {
  name: "Price",
  dicts: ['price_type', 'charge_type'],
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
      // 价格表格数据
      priceList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        pileId: null,
        ruleId: null,
        servicePrice: null,
        priceType: null,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        chargeType: [
          {required: true, message: "计费类型不能为空", trigger: "change"}
        ],
      }
    };
  },
  created() {
    this.getList();
  },
  methods: {
    /** 查询价格列表 */
    getList() {
      this.loading = true;
      listPrice(this.queryParams).then(response => {
        this.priceList = response.data;
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
        priceId: null,
        chargeType: null,
        time: null,
        price: null,
        hours: null,
        type: null,
        granternum: null,
        granterprice: null,
        pileId: null,
        ruleId: null,
        delFlag: null,
        servicePrice: null,
        minWatt: null,
        maxWatt: null,
        createtime: null,
        updateTime: null,
        priceType: null,
        rangTime: null,
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
      this.ids = selection.map(item => item.priceId)
      this.single = selection.length !== 1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset();
      this.open = true;
      this.title = "添加价格";
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const priceId = row.priceId || this.ids
      getPrice(priceId).then(response => {
        this.form = response.data;
        this.open = true;
        this.title = "修改价格";
      });
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.form.priceId != null) {
            updatePrice(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addPrice(this.form).then(response => {
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
      const priceIds = row.priceId || this.ids;
      this.$modal.confirm('是否确认删除当前价格数据项？').then(function () {
        return delPrice(priceIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('operator/price/export', {
        ...this.queryParams
      }, `价格_${parseTime(new Date().getTime(), '{y}-{m}-{d}')}.xlsx`)
    }
  }
};
</script>
