<template>
  <div class="app-container monitor-page">
    <div class="monitor">
      <aside class="station-panel">
        <div class="panel-head">
          <span class="panel-title">充电站列表</span>
          <span class="panel-count">{{ dataList.length }}</span>
        </div>
        <div class="panel-search">
          <el-input
            placeholder="搜索站点"
            prefix-icon="el-icon-search"
            v-model="filterText"
            clearable
          >
          </el-input>
        </div>
        <div class="panel-tree">
          <el-tree
            class="filter-tree"
            :data="dataList"
            :props="defaultProps"
            :default-checked-keys="defaultkeys"
            :expand-on-click-node="false"
            node-key="stationId"
            highlight-current
            @node-click="handleNodeClick"
            :filter-node-method="filterNode"
            ref="tree"
          >
          </el-tree>
        </div>
      </aside>

      <section class="monitor-main" v-loading="loading">
        <header class="monitor-head">
          <div class="monitor-head-text">
            <h2 class="monitor-title">实时监控</h2>
            <p class="monitor-sub">
              {{ stationName || "请从左侧选择充电站" }}
              <template v-if="chargingArr.length">
                · 共 {{ total }} 个端口，10 秒自动刷新
              </template>
            </p>
          </div>
          <div class="monitor-legend">
            <span><i class="dot idle"></i>空闲</span>
            <span><i class="dot busy"></i>充电中</span>
            <span><i class="dot fault"></i>故障</span>
            <span><i class="dot off"></i>离线</span>
          </div>
        </header>

        <el-empty description="暂无数据" v-if="chargingArr.length === 0" />

        <div class="port-grid" v-else>
          <article
            class="port-card"
            v-for="item in chargingArr"
            :key="item.portId || item.pileId + '-' + item.deviceId"
            :class="'is-' + statusOf(item).cls"
          >
            <header class="port-head">
              <div class="port-id">
                <span class="port-plug">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M13 2 6 10h5l-1 5 8-9h-5l1-4z" />
                  </svg>
                </span>
                <span class="port-code">
                  {{ item.pileId || "--" }}-{{ item.deviceId }}
                </span>
              </div>
              <span class="port-status">{{ statusOf(item).text }}</span>
            </header>

            <div class="port-metrics">
              <div class="metric">
                <span class="metric-value">
                  {{
                    item.chargingCurrent
                      ? Number(item.chargingCurrent).toFixed(2)
                      : 0
                  }}<em>A</em>
                </span>
                <span class="metric-label">电流</span>
              </div>
              <div class="metric">
                <span class="metric-value">
                  {{
                    item.chargingCdgl && item.chargingCurrent
                      ? (
                          Number(item.chargingCdgl) /
                          Number(item.chargingCurrent)
                        ).toFixed(2)
                      : 0
                  }}<em>V</em>
                </span>
                <span class="metric-label">电压</span>
              </div>
              <div class="metric">
                <span class="metric-value">
                  {{
                    item.chargingCdgl ? Number(item.chargingCdgl).toFixed(2) : 0
                  }}<em>KW</em>
                </span>
                <span class="metric-label">功率</span>
              </div>
              <div class="metric">
                <span class="metric-value">{{ item.useCount || 0 }}</span>
                <span class="metric-label">次数</span>
              </div>
              <div class="metric">
                <span class="metric-value">
                  {{ item.realHour ? (item.realHour * 60).toFixed(2) : 0
                  }}<em>分钟</em>
                </span>
                <span class="metric-label">时间</span>
              </div>
              <div class="metric">
                <span class="metric-value">
                  {{ item.consumePower ? Number(item.consumePower).toFixed(2) : 0
                  }}<em>度</em>
                </span>
                <span class="metric-label">电量</span>
              </div>
            </div>

            <footer class="port-foot">
              <span class="port-flag">
                {{ item.gunInsert == 1 ? "已插枪" : "未插枪" }}
              </span>
              <el-popover
                placement="top-end"
                title="模拟充电桩"
                width="200"
                trigger="click"
                popper-class="sim-popover"
              >
                <div class="operate">
                  <el-button
                    type="primary"
                    @click="operateHandler('start', item)"
                    >启动模拟充电桩</el-button
                  >
                  <el-button
                    type="primary"
                    v-if="item.gunStatus != 1"
                    @click="operateHandler('link', item)"
                    >插枪</el-button
                  >
                  <el-button
                    type="primary"
                    v-if="item.gunStatus != 1"
                    @click="operateHandler('startCharge', item)"
                    >开始充电</el-button
                  >
                  <el-button
                    type="primary"
                    @click="operateHandler('endCharge', item)"
                    >停止充电</el-button
                  >
                  <el-button
                    type="primary"
                    v-if="item.gunInsert == 1"
                    @click="operateHandler('unlink', item)"
                    >拔枪</el-button
                  >
                  <el-button
                    type="primary"
                    @click="operateHandler('stop', item)"
                    >停止模拟充电桩</el-button
                  >
                </div>

                <button
                  class="port-gear"
                  slot="reference"
                  type="button"
                  title="模拟充电桩操作"
                >
                  <i class="el-icon-setting"></i>
                </button>
              </el-popover>
            </footer>
            <span class="port-bar"></span>
          </article>
        </div>

        <pagination
          v-show="total > 0"
          :total="total"
          :page.sync="queryParams.pageNum"
          :limit.sync="queryParams.pageSize"
          @pagination="getNewStatus"
        />
      </section>
    </div>
  </div>
</template>

<script>
import { listStation } from "@/api/operator/station";
import {
  listPort,
  startCharge,
  unlink,
  stop,
  start,
  link,
  endCharge,
} from "@/api/operator/port";
export default {
  components: {},
  data() {
    return {
      stationName: "",
      filterText: "",
      dataList: [],
      // 总条数
      total: 0,
      defaultkeys: [],
      defaultProps: {
        label: "stationName",
      },
      queryParams: {
        pageNum: 1,
        pageSize: 10,
      },
      loading: false,
      chargingArr: [],
      timer: null,
      stationId: "",
    };
  },
  computed: {},
  watch: {
    filterText(val) {
      this.$refs.tree.filter(val);
    },
  },
  methods: {
    /** 查询站点列表 */
    getList() {
      let tenantId = this.$store.state.user.tenantid;
      this.loading = true;
      listStation({
        tenantId,
        pageNum: 1,
        pageSize: 100000,
      }).then((response) => {
        this.dataList = response.data;
        if (this.dataList.length) {
          this.defaultkeys = [this.dataList[0].stationId];
          this.stationName = this.dataList[0].stationName;
          this.$nextTick(() => {
            this.$refs.tree.setCurrentKey(this.defaultkeys[0]);
            this.handleNodeClick(this.dataList[0]);
          });
        }

        this.loading = false;
      });
    },
    filterNode(value, data) {
      if (!value) return true;
      return data.stationName.indexOf(value) !== -1;
    },
    handleNodeClick(data) {
      if (!data.stationId) {
        return;
      }
      this.loading = true;
      clearInterval(this.timer);
      this.stationName = data.stationName;
      this.stationId = data.stationId;
      this.queryParams.pageNum = 1;
      listPort({ stationId: data.stationId, ...this.queryParams }).then(
        (res) => {
          this.total = res.total;
          this.chargingArr = res.data;
          this.loading = false;
        }
      );
      this.timer = setInterval(() => {
        listPort({ stationId: data.stationId, ...this.queryParams }).then(
          (res) => {
            this.total = res.total;
            this.chargingArr = res.data;
            this.loading = false;
          }
        );
      }, 10000);
    },

    //端口状态：桩离线优先，其次按枪状态
    statusOf(item) {
      if (!item) {
        return { text: "--", cls: "off" };
      }
      if (item.runningStatus === 1 || item.runningStatus === "1") {
        return { text: "离线", cls: "off" };
      }
      const typeObject = {
        0: { text: "空闲", cls: "idle" },
        1: { text: "充电中", cls: "busy" },
        2: { text: "预约", cls: "idle" },
        3: { text: "启动中", cls: "warn" },
        5: { text: "故障", cls: "fault" },
        "05": { text: "故障", cls: "fault" },
        10: { text: "启动失败", cls: "fault" },
      };
      if (item.gunStatus === null || item.gunStatus === undefined) {
        return { text: "离线", cls: "off" };
      }
      return typeObject[item.gunStatus] || { text: "空闲", cls: "idle" };
    },
    //模拟桩操作
    operateHandler(key, data) {
      switch (key) {
        case "start":
          this.operateStart(data);
          break;
        case "link":
          this.operateLink(data);
          break;
        case "startCharge":
          this.operateStartCharge(data);
          break;
        case "unlink":
          this.operateUnlink(data);
          break;
        case "stop":
          this.operateStop(data);
          break;
        case "endCharge":
          this.operateEndCharge(data);
          break;

        default:
          break;
      }
    },
    getNewStatus(id) {
      this.loading = true;
      listPort({ stationId: this.stationId, ...this.queryParams }).then(
        (res) => {
          this.total = res.total;
          this.chargingArr = res.data;
          this.loading = false;
        }
      );
    },
    //启动模拟充电桩
    async operateStart(data) {
      try {
        const res = await start({
          pileId: data.pileId,
        });
        if (res.code == 200) {
          this.getNewStatus(data.stationId);
          this.$message.success(res.data);
        } else {
          this.$message.error(res.data);
        }
      } catch (error) {
        console.log("error: ", error);
      }
    },
    //插枪
    async operateLink(data) {
      try {
        const res = await link({
          pileId: data.pileId,
          deviceId: data.deviceId,
        });
        if (res.code == 200) {
          this.getNewStatus(data.stationId);
          this.$message.success(res.data);
        } else {
          this.$message.error(res.data);
        }
      } catch (error) {
        console.log("error: ", error);
      }
    },
    //开始充电
    async operateStartCharge(data) {
      console.log("data: ", data);
      try {
        const res = await startCharge({
          userId: data.userId,
          pileId: data.pileId,
          deviceId: data.deviceId,
        });
        if (res.code == 200) {
          this.getNewStatus(data.stationId);
          this.$message.success(res.data);
        } else {
          this.$message.error(res.data);
        }
      } catch (error) {
        console.log("error: ", error);
      }
    },
    //停止充电
    async operateEndCharge(data) {
      try {
        const res = await endCharge({
          pileId: data.pileId,
          deviceId: data.deviceId,
        });
        if (res.code == 200) {
          this.getNewStatus(data.stationId);
          this.$message.success(res.data);
        } else {
          this.$message.error(res.data);
        }
      } catch (error) {
        console.log("error: ", error);
      }
    },

    //拔枪
    async operateUnlink(data) {
      try {
        const res = await unlink({
          pileId: data.pileId,
          deviceId: data.deviceId,
        });
        if (res.code == 200) {
          this.getNewStatus(data.stationId);
          this.$message.success(res.data);
        } else {
          this.$message.error(res.data);
        }
      } catch (error) {
        console.log("error: ", error);
      }
    },
    //停止模拟器
    async operateStop(data) {
      try {
        const res = await stop({
          pileId: data.pileId,
        });
        if (res.code == 200) {
          this.getNewStatus(data.stationId);
          this.$message.success(res.data);
        } else {
          this.$message.error(res.data);
        }
      } catch (error) {
        console.log("error: ", error);
      }
    },
  },
  created() {},
  mounted() {
    this.getList();
  },
  updated() {},
  beforeDestroy() {
    clearInterval(this.timer);
  },
};
</script>

<style scoped lang="scss">
.monitor-page {
  background: #f5f7fb;

  .monitor {
    display: flex;
    align-items: stretch;
    gap: 16px;
    min-height: calc(100vh - 132px);
  }

  .station-panel {
    margin-bottom: 0;
    width: 246px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #e8edf5;
    border-radius: 12px;
    padding: 16px 12px 12px;
    box-sizing: border-box;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 12px;
  }

  .panel-title {
    font-size: 15px;
    font-weight: 700;
    color: #18273d;
  }

  .panel-count {
    min-width: 22px;
    height: 20px;
    line-height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: #edf3ff;
    color: #2d59e5;
    font-size: 12px;
    text-align: center;
  }

  .panel-search {
    padding: 0 2px 10px;
  }

  .panel-tree {
    flex: 1;
    overflow: auto;

    ::v-deep .el-tree {
      background: transparent;
      color: #4a5868;
      font-size: 13px;
    }

    ::v-deep .el-tree-node__content {
      height: 36px;
      border-radius: 7px;
    }

    ::v-deep .el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content {
      background: #edf3ff;
      color: #2d59e5;
      font-weight: 600;
    }
  }

  .monitor-main {
    flex: 1;
    min-width: 0;
    background: #fff;
    border: 1px solid #e8edf5;
    border-radius: 12px;
    padding: 20px 22px 12px;
    box-sizing: border-box;
  }

  .monitor-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding-bottom: 18px;
  }

  .monitor-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #18273d;
    letter-spacing: -0.4px;
  }

  .monitor-sub {
    margin: 8px 0 0;
    font-size: 13px;
    color: #728094;
  }

  .monitor-legend {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 6px;
    font-size: 12px;
    color: #697688;

    span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;

      &.idle {
        background: #2d59e5;
      }

      &.busy {
        background: #13826b;
      }

      &.fault {
        background: #d8443c;
      }

      &.off {
        background: #b3bccb;
      }
    }
  }

  .port-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }

  .port-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #e8ebf7;
    border-radius: 12px;
    padding: 0 0 12px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(41, 55, 73, 0.05);
    transition: box-shadow 0.2s ease, transform 0.2s ease;

    &:hover {
      box-shadow: 0 10px 24px rgba(41, 55, 73, 0.1);
    }

    &.is-busy {
      border-color: #a9d8c8;
    }

    &.is-fault {
      border-color: #f0b8b4;
    }

    &.is-off {
      background: #fbfcfd;
      box-shadow: none;

      .port-code,
      .port-status,
      .metric-value,
      .metric-label,
      .port-flag {
        color: #a6a8b0;
      }

      .port-plug {
        background: #eef1f5;
        color: #a6a8b0;
      }
    }
  }

  .port-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px;
    background: #edf3ff;
  }

  .port-id {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .port-plug {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 9px;
    background: #edf3ff;
    color: #2d59e5;
    display: grid;
    place-items: center;

    svg {
      width: 17px;
      height: 17px;
      fill: currentColor;
    }
  }

  .port-code {
    font-size: 14px;
    font-weight: 600;
    color: #18273d;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .port-status {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    background: #edf3ff;
    color: #2d59e5;

    .is-busy & {
      background: #e9f6f1;
      color: #13826b;
    }

    .is-fault & {
      background: #fdeceb;
      color: #d8443c;
    }

    .is-warn & {
      background: #fff4e6;
      color: #b86a0c;
    }

    .is-off & {
      background: #eef1f5;
      color: #a6a8b0;
    }
  }

  .port-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 30px 10px;
    padding: 30px 18px;
    border-bottom: 1px solid #f0f3f9;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    text-align: center;
  }

  .metric-value {
    font-size: 22px;
    font-weight: 700;
    color: #18273d;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;

    em {
      margin-left: 3px;
      font-size: 11px;
      font-style: normal;
      font-weight: 500;
      color: #728094;
    }
  }

  .metric-label {
    font-size: 12px;
    color: #8b95a7;
  }

  .port-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 18px 0;
  }

  .port-flag {
    font-size: 12px;
    color: #8b95a7;
  }

  .port-gear {
    width: 30px;
    height: 30px;
    border: 1px solid #e8ebf7;
    border-radius: 8px;
    background: #fff;
    color: #5f7df9;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 14px;
    transition: all 0.2s ease;

    &:hover {
      background: #edf3ff;
      border-color: #c9d8ff;
    }
  }

  .port-bar {
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 0;
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: #2d59e5;

    .is-busy & {
      background: #13826b;
    }

    .is-fault & {
      background: #d8443c;
    }

    .is-warn & {
      background: #dc9244;
    }

    .is-off & {
      background: #d5dbe4;
    }
  }

  @media (max-width: 1100px) {
    .station-panel { width: 210px; }
    .port-grid { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 700px) {
    padding: 12px;
    .monitor { flex-direction: column; }
    .station-panel { width: 100%; }
    .panel-tree { max-height: 180px; }
    .monitor-main { padding: 16px; }
    .port-code { font-size: 12px; }
    .metric-value { font-size: 18px; }
  }
}
</style>

<style lang="scss">
.sim-popover {
  padding: 12px 12px 6px;

  .operate {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-button {
      width: 100%;
      margin-left: 0;
      background: #008773;
      border-color: #008773;
      color: #fff;
      &:hover, &:focus { background: #006f61; border-color: #006f61; color: #fff; }
    }

    .el-button + .el-button {
      margin-left: 0;
    }
  }
}
</style>
