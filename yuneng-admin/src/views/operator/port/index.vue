<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="98px">
      <el-form-item label="充电桩编号" prop="pileId">
        <el-input
          v-model="queryParams.pileId"
          placeholder="请输入充电桩编号"
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


    <el-table v-loading="loading" :data="portList">
      <el-table-column fixed label="序号" min-width="80px"   align="center">
        <template slot-scope="scope">
          <span>{{(queryParams.pageNum-1)*queryParams.pageSize+(scope.$index + 1)}} </span>
        </template>
      </el-table-column>
      <el-table-column label="充电桩类型" align="center" prop="pileType">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.pile_type" :value="scope.row.pileType"/>
        </template>
      </el-table-column>
      <el-table-column label="枪口名" align="center" prop="name"/>
      <el-table-column label="枪口编号" align="center" prop="deviceId"/>
      <el-table-column label="状态" align="center" prop="state">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.port_state" :value="scope.row.state ? scope.row.state.split(',') : []"/>
        </template>
      </el-table-column>
      <el-table-column label="充电桩编号" align="center" prop="pileId"/>

      <el-table-column label="二维码" align="center" prop="qrCode" width="100">
        <template slot-scope="scope">
          <image-preview :src="scope.row.qrCode" :width="50" :height="50"/>
        </template>
      </el-table-column>

      <el-table-column label="创建时间" align="center" prop="createtime" width="180">
        <template slot-scope="scope">
          <span>{{ scope.row.createTime }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" align="center" class-name="small-padding fixed-width"  min-width="220px">
        <template slot-scope="scope">
          <el-button

            type="primary"
            @click="handleUpdate(scope.row)"
          >枪口编辑
          </el-button
          >
          <!-- <el-link @click="getUseRecodsHandler(scope.row)">使用记录</el-link> -->
          <el-button

            type="danger"
            @click="deleteHandler(scope.row)"
          >删除
          </el-button
          >
          <el-button

            type="success"
            @click="switchPort(scope.row.portId, 1)"
            v-show="scope.row.state != 'N' && scope.row.state != 'Y'"
          >开启
          </el-button
          >
          <el-button

            @click="switchPort(scope.row.portId, 0)"
            v-show="scope.row.state != 'F'"
          >关闭
          </el-button
          >
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

    <!-- 添加或修改充电桩端口对话框 -->
    <el-dialog :title="title" :visible.sync="open" width="500px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">

        <el-form-item label="枪口编号" prop="deviceId">
          <el-input v-model="form.deviceId" disabled placeholder="请输入端口ID"/>
        </el-form-item>

        <el-form-item label="枪口名称" prop="name">
          <el-input v-model="form.name"  placeholder="请输入端口ID"/>
        </el-form-item>

        <el-form-item label="枪口状态" prop="state">
          <el-radio-group v-model="form.state">
            <el-radio
              v-for="dict in dict.type.port_state"
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
import {listPort, getPort, delPort, updatePort,switchPort } from "@/api/operator/port";
import {parseTime} from "@/utils/hcp";

export default {
  name: "Port",
  dicts: ['port_state','pile_type'],
  data() {
    return {
      // 遮罩层
      loading: true,
      // 选中数组
      ids: [],
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 充电桩端口表格数据
      portList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        state: null,
        pileId: null,
        gunInsert: null,
        gunStatus: null,
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
    /** 查询充电桩端口列表 */
    getList() {
      this.loading = true;
      listPort(this.queryParams).then(response => {
        this.portList = response.data;
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
        portId: null,
        pileId: null,
        state: null,
        name: null,
      };
      this.resetForm("form");
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1;
      this.getList();
    },


    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();

      getPort(row.portId).then(response => {
        this.form = response.data;
        this.form.pileType = row.pileType;
        this.open = true;
        this.title = "修改充电桩端口";
      });
    },
    /** 提交按钮 */
    submitForm() {
      console.log(this.form)
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.form.portId != null) {
            updatePort(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          }
        }
      });
    },
    /** 删除按钮操作 */
    deleteHandler(row) {
      const portIds = row.portId || this.ids;
      this.$modal.confirm('是否确认删除当前充电桩端口数据项？').then(function () {
        return delPort(portIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },
    switchPort(id, type) {
      let params = {
        id: id,
        type: type,
      };
      switchPort(params).then((res) => {
        if (res.code == 200) {
          this.$message({
            message: (type == 1 ? "枪口开启" : "枪口关闭") + "成功",
            type: "success",
          });
          this.getList();
        } else {
          this.$message({
            message: res.msg,
            type: "success",
          });
        }
      });
    },


  }
};
</script>
