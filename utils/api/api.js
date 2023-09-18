/*
 * @Author: lzx
 * @Date: 2021-10-29 13:42:13
 * @LastEditors: lzx
 * @LastEditTime: 2022-06-27 16:15:33
 * @Description: Fuck Bug
 * @FilePath: \reconsitution_talk_vant\utils\api\api.js
 */
import request from "./request.js"

// 校验会议-登录接口
export function verifyMeeting (data) {
  //这里调用request.js里面封装的请求方法
  return request({
    url: "/meeting/auth",
    method: 'post',
    // 携带的参数
    data
  })
}
// 加入会议
export function joinMeetingFun (data) {
  return request({
    url: '/meeting/join',
    method: 'post',
    data
  })
}
// 退出会议
export function outMeeting (data, orderId, userId) {
  return request({
    url: `/meeting/leave/${data.orderId}/${data.userId}`,
    method: 'delete',

  })
}
// 提交签名
export function signUpload (data) {
  return request({
    url: `/meeting/sign/upload/${data.meetingId}/${data.userId}`,
    method: 'post',
    data: {
      base64Str: data.base64Str
    }
  })
}
// 确认笔录
export function checkConfirm (data) {
  return request({
    url: `/meeting/checkConfirm/${data.meetingId}/${data.userId}`,
    method: 'post',
  })
}
// 获取应用信息
export function getAppInfo (data) {
  return request({
    url: '/meeting/getAppInfo',
    method: 'get',
  })
}
// 参会人员列表
export function getMeetingPersonnelList (data) {
  return request({
    url: `/sign/member/${data.meetingId}`,
    method: 'get',
  })
}
// 上传图片
export function uploadingImg (data) {
  return request({
    url: `/meeting/uploadFile`,
    method: 'post',
    data
  })
}
// 上传签名Base64（新接口，老接口，在PC上无法上传）
export function uploadBase64 (data) {
  return request({
    url: `/meeting/sign/uploadBase64`,
    method: 'post',
    data
  })
}
// 主动拉取笔录
export function userGetNote (data) {
  return request({
    url: `/meeting/getNote/${data.orderId}/${data.userId}`,
    method: 'get',
  })
}
// 静音接口
export function setMicStatus (data) {
  return request({
    url: `/meeting/setMicStatus/${data.meetingId}/${data.userId}/${data.enable}`,
    method: 'post',
  })
}
// 获取人脸识别结果
export function getFaceResult (token) {
  return request({
    url: `/meeting/getEidResult/${token}`,
    method: 'get',
  })
}