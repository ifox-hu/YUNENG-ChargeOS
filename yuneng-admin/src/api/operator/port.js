import request from "@/utils/request";

// 查询充电桩端口列表
export function listPort(query) {
  return request({
    url: "/operator/port/list",
    method: "get",
    params: query,
  });
}

// 查询充电桩端口详细
export function getPort(portId) {
  return request({
    url: "/operator/port/" + portId,
    method: "get",
  });
}

// 新增充电桩端口
export function addPort(data) {
  return request({
    url: "/operator/port",
    method: "post",
    data: data,
  });
}

// 修改充电桩端口
export function updatePort(data) {
  return request({
    url: "/operator/port",
    method: "put",
    data: data,
  });
}

// 删除充电桩端口
export function delPort(portId) {
  return request({
    url: "/operator/port/" + portId,
    method: "delete",
  });
}

export function switchPort(portId) {
  return request({
    url: "/operator/port/switchPort",
    method: "post",
    params: portId,
  });
}

//模拟充电桩
// 开始充电
export function startCharge(data) {
  return request({
    url: "/simulator/evcs/sim/v1/startCharge",
    method: "post",
    data,
  });
}
// 拔枪
export function unlink(params) {
  return request({
    url: "/simulator/evcs/sim/v1/unlink",
    method: "get",
    params,
  });
}
// 停止模拟充电桩
export function stop(params) {
  return request({
    url: "/simulator/evcs/sim/v1/stop",
    method: "get",
    params,
  });
}

// 开始模拟充电桩
export function start(params) {
  return request({
    url: "/simulator/evcs/sim/v1/start",
    method: "get",
    params,
  });
}

// 插枪
export function link(params) {
  return request({
    url: "/simulator/evcs/sim/v1/link",
    method: "get",
    params,
  });
}

// 停止充电
export function endCharge(params) {
  return request({
    url: "/simulator/evcs/sim/v1/endCharge",
    method: "get",
    params,
  });
}
