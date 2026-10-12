<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">

      <el-form-item label="" prop="userId">
        <el-select clearable v-model="queryParams.userId" placeholder="用户">
          <el-option
            v-for="item in userList"
            :key="item.value"
            :label="item.nickName"
            :value="item.userId"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="" prop="changeName">
        <el-input
          v-model="queryParams.changeName"
          placeholder="规则名称"
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
        <el-button
          style="margin-left: 30px" class="import-btn"
          type="primary"
          icon="el-icon-plus"
          @click="addHandler"
        >新增
        </el-button>

      </el-form-item>

    </el-form>



    <el-table v-loading="loading" :data="ruleList">
      <el-table-column
        fixed label="序号"
        width="80"
        align="center">
        <template slot-scope="scope">
          <span>{{(queryParams.pageNum-1)*queryParams.pageSize+(scope.$index + 1)}} </span>
        </template>
      </el-table-column>
      <el-table-column
        prop="changeName"
        label="规则名称"
        align="center"
        min-width="120"
        :show-overflow-tooltip="true"
      ></el-table-column>
      <!--                <el-table-column prop="ruleTypeName" align="center" label="规则类型" min-width="80"></el-table-column>-->
      <el-table-column
        prop="userName"
        label="用户"
        align="center"
        min-width="100"
      ></el-table-column>
      <el-table-column
        prop="isSysGive"
        label="平台默认"
        align="center"
        min-width="120">
        <template slot-scope="scope">
          <dict-tag :options="dict.type.hcp_ys_no" :value="scope.row.isSysGive"/>
        </template>
      </el-table-column>
      <el-table-column
        prop="isGive"
        label="用户默认"
        align="center"
        min-width="120">
      <template slot-scope="scope">
        <dict-tag :options="dict.type.hcp_ys_no" :value="scope.row.isGive"/>
      </template>
      </el-table-column>
      <el-table-column
        prop="createTime"
        label="创建时间"
        align="center"
        min-width="120"
      ></el-table-column>
      <el-table-column label="操作" align="center"   min-width="220px">
        <template slot-scope="scope">
          <div class="editCell">
            <el-button type="success" @click="editHandler(scope.row)"
            >修改规则</el-button
            >
            <!--                        <el-link @click="price(scope.row)">配置价格</el-link>&nbsp;&nbsp;&nbsp;-->
            <el-button type="primary" @click="copyHandler(scope.row)"
            >复制规则</el-button
            >

            <el-button
              type="danger"
              v-if="scope.row.isSysGive != 1"
              @click="deteteHandlet(scope.row)"
            >删除</el-button
            >
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

    <el-dialog :title="dialogTitle" :visible.sync="dialogVisible" width="800px">
      <el-form ref="form" :model="formData" label-width="150px" :rules="formRule">
        <el-form-item class="nav-form-item" label="规则名称" prop="changeName">
          <el-input
            maxlength="20"
            v-model="formData.changeName"
            style="width: 425px"
            placeholder="请输入规则名称"
            clearable
          />
        </el-form-item>
        <el-form-item class="nav-form-item" label="费用设置">
          <div class="tipmincc">
            （峰、平、谷时段价格均为必填项。因各地电价不同，请根据当地实际电价填写。）
          </div>
          <el-row
            v-for="(item, index) in priceTypeList"
            :key="index"
            style="margin-bottom: 5px"
          >
            <el-tag
              :style="
                'margin-right: 20px;color: #fff;background-color: ' +
                item.cor +
                ';border-color:' +
                item.cor
              "
            >{{ item.txt }}</el-tag
            >
            <el-input-number
              v-model="item.price"
              controls-position="right"
              :min="0.0"
              :max="10"
              :step="0.001"
              style="width: 120px; margin-right: 10px"
            ></el-input-number
            ><label>电费（元/度）</label>
            <el-input-number
              v-model="item.servicePrice"
              controls-position="right"
              :min="0.0"
              :max="10"
              :step="0.1"
              style="width: 120px; margin-right: 10px"
            ></el-input-number
            ><label>服务费（元/度）</label>
          </el-row>
        </el-form-item>
        <el-form-item class="nav-form-item" label="24小时分布设置">
          <div class="tipmincc">
            （时间设置最小间隔为30分钟；最多可设置48个计费时段。）
          </div>
          <el-row>
            <el-col
              v-for="(item, index) in formData.priceList"
              :key="index"
              style="margin-bottom: 4px"
            >
              <el-select
                v-model="item.priceType"
                placeholder="费用类型"
                style="width: 100px"
              >
                <el-option
                  v-for="type in priceTypeList"
                  :key="type.priceType"
                  :label="type.txt"
                  :value="type.priceType"
                ></el-option>
              </el-select>
              <el-time-select
                :class="item.classStartTime"
                placeholder="开始时间"
                v-model="item.startTime"
                :picker-options="pickerOptions"
                disabled
                style="width: 120px"
              ></el-time-select>
              <el-time-select
                :class="item.classEndTime"
                placeholder="结束时间"
                v-model="item.endTime"
                :picker-options="{
                  start: index > 0 ? addTime30(item.startTime) : '00:30',
                  step: '00:30',
                  end: '23:30',
                }"
                @change="cgEndTime(item, index)"
                :disabled="index == formData.priceList.length - 1"
                style="width: 120px"
              ></el-time-select>
              <el-button
                type="primary"
                icon="el-icon-plus"
                style="margin-left: 20px"
                v-if="
                  (index != formData.priceList.length - 1 && item.endTime != '23:30') ||
                  index == 0
                "
                @click="plusPrice(index)"
              ></el-button>
              <el-button
                type="danger"
                icon="el-icon-minus"
                style="margin-left: 20px"
                v-if="index != 0 && index != formData.priceList.length - 1"
                @click="minusPrice(index)"
              ></el-button>
            </el-col>
          </el-row>
        </el-form-item>
      </el-form>

      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="confimHandler">确 定</el-button>
      </span>
    </el-dialog>

    <el-dialog title="复制规则" :visible.sync="dialogVisibleCopy" width="40%">
      <el-form ref="form" :model="formDataCopy" label-width="150px" :rules="formRule">
        <el-form-item class="nav-form-item" label="规则名称" prop="changeName">
          <el-input
            maxlength="20"
            v-model="formDataCopy.changeName"
            style="width: 300px"
            placeholder="请输入规则名称"
            clearable
          />
        </el-form-item>

        <el-form-item class="nav-form-item" label="所属代理商" prop="userID">
          <el-select clearable v-model="formDataCopy.userId" placeholder="所属代理商">
            <el-option
              v-for="(item, index) in userList"
              :key="index"
              :label="item.nickName"
              :value="item.userId"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="dialogVisibleCopy = false">取 消</el-button>
        <el-button type="primary" @click="copyConfimHandler">确 定</el-button>
      </span>
    </el-dialog>


  </div>
</template>

<script>
import {listRule, copyRule, deleteRule, addRule, getRulePriceList} from "@/api/operator/rule";
import {parseTime} from "@/utils/hcp";
import {getUserList} from "@/api/system/user";

export default {
  name: "Rule",
  dicts: ['hcp_ys_no', 'device_type', 'rule_type'],
  data() {
    return {
      // 遮罩层
      loading: true,
      // 选中数组
      ids: [],
      userList:[],
      dialogVisible:false,
      dialogVisibleCopy: false,
      dialogTitle:'新增四轮车计费规则',
      pickerOptions: { start: "00:30", step: "00:30", end: "23:30" },
      priceTypeList: [
        {
          id: "",
          priceType: 0,
          price: 1.044,
          servicePrice: 0.8,
          txt: "尖时段",
          cor: "#f56c6c",
        },
        {
          id: "",
          priceType: 1,
          price: 1.044,
          servicePrice: 0.8,
          txt: "峰时段",
          cor: "#e6a23c",
        },
        {
          id: "",
          priceType: 2,
          price: 0.695,
          servicePrice: 0.8,
          txt: "平时段",
          cor: "#67c23a",
        },
        {
          id: "",
          priceType: 3,
          price: 0.946,
          servicePrice: 0.8,
          txt: "谷时段",
          cor: "#909399",
        },
      ],
      priceList: [
        {
          price: 0.946,
          priceType: 3,
          servicePrice: 0.8,
          startTime: "00:00",
          endTime: "08:00",
          classStartTime: "",
          classEndTime: "",
        },
        {
          price: 0.695,
          priceType: 2,
          servicePrice: 0.8,
          startTime: "08:00",
          endTime: "10:00",
          classStartTime: "",
          classEndTime: "",
        },
        {
          price: 1.044,
          priceType: 1,
          servicePrice: 0.8,
          startTime: "10:00",
          endTime: "13:00",
          classStartTime: "",
          classEndTime: "",
        },
        {
          price: 1.044,
          priceType: 0,
          servicePrice: 0.8,
          startTime: "13:00",
          endTime: "24:00",
          classStartTime: "",
          classEndTime: "",
        },
      ],

      formData: {
        cardNo: "",
        mobile: "",
        sum: 0,
        chargeType: "",
        ruleType: "",
        changeName: "",
        isGive: "",
        isSysGive: "",
        userId: "",
        priceList: [],
      },
      formDataCopy: {
        id: "",
        changeName: "",
        userId: "",
      },
      formRule: {
        changeName: [{ required: true, message: "请输入必填项", trigger: "blur" }],
      },
      isAdd: true,
      // 非单个禁用
      single: true,
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 收费规则表格数据
      ruleList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        changeName: null,
        chargeType: null,
        ruleType: null,
        userId: null,
        deviceType: null,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        ruleType: [
          {required: true, message: "规则类型不能为空", trigger: "change"}
        ],
        isGive: [
          {required: true, message: "默认规则不能为空", trigger: "change"}
        ],
        isSysGive: [
          {required: true, message: "平台默认规则 1:是 0:否不能为空", trigger: "change"}
        ],
      }
    };
  },
  created() {
    this.getList();
    this.getUserList();
  },
  methods: {
    /** 查询收费规则列表 */
    getList() {
      this.loading = true;
      listRule(this.queryParams).then(response => {
        this.ruleList = response.data;
        this.total = response.total;
        this.loading = false;
      });
    },
    getUserList(){
      getUserList().then((res) => {
        this.userList = res.data;
      })
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
        changeName: null,
        chargeType: null,
        ruleType: null,
        userId: null,
        createtime: null,
        isGive: 0,
        isSysGive: 0,
        deviceType: 0,
        updateTime: null,
        maxHour: null,
        tenantId: null

      };
      this.resetForm("form");
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1;
      this.getList();
    },

    /** 删除按钮操作 */
    handleDelete(row) {
      const ids = row.id || this.ids;
      this.$modal.confirm('是否确认删除当前收费规则数据项？').then(function () {
        return delRule(ids);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {
      });
    },

    editHandler(row) {
      this.isAdd = false;
      console.log(row)
      this.formData.changeName = row.changeName;
      this.formData.id = row.id;
      this.formData.priceList = [];
      this.priceTypeList.forEach((item, i) => {
        this.priceTypeList[i].id = "";
      });

      getRulePriceList({ ruleId: row.id }).then((res) => {
        console.log(res)
        if (res.data && res.data.length > 0) {
          res.data.map((item) => {
            if (item.rangTime) {
              //还原价格
              this.priceTypeList[item.priceType].id = item.id;
              this.priceTypeList[item.priceType].price = item.price * 1;
              this.priceTypeList[item.priceType].servicePrice = item.servicePrice * 1;

              var rangTime = JSON.parse(item.rangTime);
              rangTime.map((it) => {
                //时间
                this.formData.priceList.push({
                  priceType: item.priceType,
                  startTime: this.getTime(it.startTime),
                  endTime: this.getTime(it.endTime),
                  classStartTime: "",
                  classEndTime: "",
                });
              });
            }
          });
          console.log("最后数据:" + JSON.stringify(this.formData.priceList));
          var list = this.formData.priceList;
          list.sort(this.sortByTime);
          console.log("排序后的数据:" + JSON.stringify(list));
          this.formData.priceList = list;
        }
      });

      this.dialogVisible = true;
    },
    copyHandler(row) {
      this.isAdd = false;
      this.formDataCopy.changeName = row.changeName;
      this.formDataCopy.id = row.id;
      this.dialogVisibleCopy = true;
    },

    addHandler() {
      this.isAdd = true;
      this.dialogVisible = true;
      this.dislogTitle = "新增四轮车计费规则";
      //0:尖 1:峰 2:平 3:谷"
      this.formData = {
        changeName: "",
        priceList: [...this.priceList],
      };
    },
    confimHandler() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          var c = 0;
          var op = true;
          //严重时间段是否连续
          this.formData.priceList.forEach((item, index) => {
            var startTime = item.startTime.replace(":", ".").replace("30", "5") * 1;
            var endTime = item.endTime.replace(":", ".").replace("30", "5") * 1;

            if (index < this.formData.priceList.length - 1) {
              var startTime2 = this.formData.priceList[index + 1].startTime
                .replace(":", ".")
                .replace("30", "5");
              var endTime2 = this.formData.priceList[index + 1].endTime
                .replace(":", ".")
                .replace("30", "5");

              //时间相同校验
              if (endTime == startTime) {
                this.formData.priceList[index].classEndTime = "error_input";
                this.formData.priceList[index].classStartTime = "error_input";
                this.$message.error("开始时间和截止时间不能相同");
                op = false;
              }
              //开始时间小于结束时间
              if (endTime < startTime) {
                this.formData.priceList[index].classEndTime = "error_input";
                this.formData.priceList[index].classStartTime = "error_input";
                this.$message.error("开始时间不能小于结束时间");
                op = false;
              }

              //时间连续校验
              if (endTime != startTime2) {
                this.formData.priceList[index].classEndTime = "error_input";
                this.formData.priceList[index + 1].classStartTime = "error_input";
                this.$message.error("时间必须连续");
                op = false;
              }
              if (op) {
                this.formData.priceList[index].classEndTime = "";
                this.formData.priceList[index + 1].classStartTime = "";
              }
            }
            c = c + (endTime - startTime);
          });
          if (op) {
            if (c == 24) {
              if (this.isAdd) {
                this.addRule();
              } else {
                this.editRule();
              }
            } else {
              this.$message.error("时间必须连续");
            }
          }
        }
      });
    },

    addRule() {
      var priceList = new Array();

      //0:尖 1:峰 2:平 3:谷
      var priceListObj = {};
      for (var i = 0; i < 4; i++) {
        priceListObj["timeRangeList" + i] = {
          priceType: i,
          price: this.priceTypeList[i].price,
          servicePrice: this.priceTypeList[i].servicePrice,
          timeRangeList: [],
        };
      }
      this.formData.priceList.forEach((item) => {
        var startTime = item.startTime.replace(":", ".").replace("30", "5") * 1;
        var endTime = item.endTime.replace(":", ".").replace("30", "5") * 1;
        priceListObj["timeRangeList" + item.priceType].timeRangeList.push({
          startTime: startTime,
          endTime: endTime,
        });
      });
      for (var i = 0; i < 4; i++) {
        priceList.push(priceListObj["timeRangeList" + i]);
      }
      var params = {
        userId: this.operatorId,
        changeName: this.formData.changeName,
        priceList: priceList,
      };
      console.log(params);
      addRule(params).then((res) => {
        if (res.code == 200) {
          this.$message({
            message: "新增成功",
            type: "success",
          });
          this.dialogVisible = false;
          this.getDataList();
        } else {
          this.$message.error(res.msg);
        }
      });
    },

    editRule() {
      var priceList = new Array();

      //0:尖 1:峰 2:平 3:谷
      var priceListObj = {};
      for (var i = 0; i < 4; i++) {
        priceListObj["timeRangeList" + i] = {
          id: this.priceTypeList[i].id,
          priceType: i,
          price: this.priceTypeList[i].price,
          servicePrice: this.priceTypeList[i].servicePrice,
          timeRangeList: [],
        };
      }
      this.formData.priceList.forEach((item) => {
        var startTime = item.startTime.replace(":", ".").replace("30", "5") * 1;
        var endTime = item.endTime.replace(":", ".").replace("30", "5") * 1;
        priceListObj["timeRangeList" + item.priceType].timeRangeList.push({
          startTime: startTime,
          endTime: endTime,
        });
      });
      for (var i = 0; i < 4; i++) {
        priceList.push(priceListObj["timeRangeList" + i]);
      }
      var params = {
        id: this.formData.id,
        userId: this.operatorId,
        changeName: this.formData.changeName.replace("公众号-", ""),
        priceList: priceList,
      };
      console.log(params);
      editRule(params).then((res) => {
        if (res.message.code == 0) {
          this.$message({
            message: "操作成功",
            type: "success",
          });
          this.dialogVisible = false;
          this.getDataList();
        } else {
          this.$message.error(res.message.message);
        }
      });
    },

    addTime30(strTime) {
      if (strTime.indexOf(":00") != -1) {
        return strTime.replace(":00", ":30");
      } else {
        return strTime
          .replace(strTime.split(":")[0], strTime.split(":")[0] * 1 + 1)
          .replace(":30", ":00");
      }
    },
    plusPrice(index) {
      if (this.formData.priceList.length >= 48) {
        this.$message.error("最多只能设置48个时间段哦");
        return;
      }
      let item = JSON.parse(JSON.stringify(this.formData.priceList[index]));
      item.startTime = this.formData.priceList[index].endTime;
      this.formData.priceList.splice(index + 1, 0, item);
      if (item.startTime == "23:00") {
        item.endTime = "23:30";
        this.formData.priceList[index + 1].startTime = "23:00";
        if (index + 1 < this.formData.priceList.length) {
          this.formData.priceList[index + 2].startTime = "23:30";
        }
      }
    },
    minusPrice(index) {
      this.formData.priceList[index - 1].endTime = this.formData.priceList[index].endTime;
      this.formData.priceList.splice(index, 1);
    },
    getTime(num) {
      num = num + "";
      if (num.indexOf(".") != -1) {
        num = num.replace(".5", ":30");
      } else if (num.indexOf(".") == -1) {
        num = num + ":00";
      }
      if (num.length < 3) {
        num = "0" + num;
      }
      return num;
    },


    copyConfimHandler() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          this.copyRule();
        }
      });
    },

    copyRule() {
      copyRule(this.formDataCopy).then((res) => {
        if (res.code == 200) {
          this.$message({
            message: "复制成功",
            type: "success",
          });
          this.dialogVisibleCopy = false;
          this.getDataList();
        } else {
          this.$message.error(res.msg);
        }
      });
    },
    deteteHandlet(row) {
      if (row.pileCount && row.pileCount > 0) {
        this.$message.error("当前规则正在使用中，不可删除");
        return;
      }
      if (row.isGive == "1" || row.isSysGive == "1") {
        this.$message.error("系统默认规则，不可删除");
        return;
      }
      this.$confirm("确定删除所选项吗?", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }).then(() => {
        let param = {
          id: row.id,
        };
        deleteRule(param).then((res) => {
          if (res.message.code == 0) {
            this.$message({
              message: "操作成功",
              type: "success",
            });
            this.getDataList();
          } else {
            this.$message.error(res.message.message);
          }
        });
      });
    },
  }
};
</script>
