/*
* @Author: lzx
* @Date: 2022-05-06 13:33:43
 * @LastEditors: lzx
 * @LastEditTime: 2022-08-01 18:00:58
* @Description: Fuck Bug
 * @FilePath: \reconsitution_talk_vant\utils\tool.js
*/
const app = getApp()
const log = require('../log')
/*函数节流*/
const throttle1 = (fn, interval) => {
  let enterTime = 0; // 触发的时间
  let gapTime = interval || 500; // 间隔时间，如果interval不传，则默认300ms
  return function (...args) {
    var context = this;
    var backTime = new Date(); // 第一次函数return即触发的时间
    if (backTime - enterTime > gapTime) {
      fn.call(context, args);
      enterTime = backTime; // 赋值给第一次触发的时间，这样就保存了第二次触发的时间
    }
  };
}
const throttle=(fun, wait) =>{
  let timer = null;
  return function (args) {
    let context=this;
    if (timer) clearTimeout(timer); //取消之前的计时
    timer = setTimeout(function () {
      fun.call(context, args);
    }, wait);
  };
};
/*函数防抖*/
const debounce = (fn, interval) => {
  let timer;
  let gapTime = interval || 500; // 间隔时间，如果interval不传，则默认500ms
  return function () {
    clearTimeout(timer);
    var context = this;
    var args = arguments; // 保存此处的arguments，因为setTimeout是全局的，arguments不是防抖函数需要的。
    timer = setTimeout(function () {
      fn.call(context, args);
    }, gapTime);
  };
}
/**
 * 检测用户设备跳转：0 - 横屏,1 - 竖屏
 * @param {*} appModel 
 * @returns 
 */
const deviceType = (appModel) => {
  let appType = wx.getStorageSync('userData');
  log.info('检测用户设备跳转：', appModel || appType.appModel || '');
  if (app.data.platform === 'android' || app.data.platform === 'ios') {
    switch (appModel || appType.appModel) {
      case 0:
        reLaunchGo('/pages/meetingVertical/meetingVertical')
        break
      case 1:
        reLaunchGo('/pages/meeting/meeting')
        break
      default:
        reLaunchGo('/pages/meeting/meeting')
        break
    }
  } else {
    reLaunchGo('/pages/meetingVertical/meetingVertical')
  }
}
/**
 * 页面跳转
 * @param {*} url 
 */
const reLaunchGo = (url) => {
  setTimeout(() => {
    wx.reLaunch({
      url: url
    })
  }, 1000)
}
/**
 * 去掉登录的相关缓存
 */
const removeStorageInfo = () => {
  log.info('去掉登录的相关缓存');
  // 清除本地缓存的user
  wx.removeStorageSync('user');
  wx.removeStorageSync('options');
  wx.removeStorageSync('WsInfo');
  wx.removeStorageSync('emceeList');
  wx.removeStorageSync('meetingUserList')
};
// 处理跳转页面
const detectionSkipPage = () => {
  let menuStatus = app.globalData.platform === 'windows' ? false : app.globalData.platform === 'devtools' ? false : app.globalData.platform === 'mac' ? false : true // 设备类型
  if (menuStatus) {
    wx.reLaunch({
      url: '/pages/index/index',
    })
  } else {
    wx.reLaunch({
      url: '/pages/pcIndex/index',
    })
  }
};
/**
 * 检测设备类型
 */
const detectionDeviceType = () => {
  return wx.getSystemInfoSync();
};
/**
 * 获取时间戳
 * @returns
 */
const getTime = () => {
  let date = new Date()
  return date.valueOf()
}

/**
 * 获取时间
 * @returns 
 */
const getTimeData = () => {
  let date = new Date()
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getHours()
}
/**
 * 大日志服务
 * @param {*} data 
 */
const bigLogs = (data) => {
  let param = {
    index: `weixin_${data.log}_${getTimeData()}`,
    timeStamp: getTime(),
    id: data.orderId,
    businessId: data.businessId,
    level: data.type,
    message: data.message
  }
}
export default {
  throttle,
  debounce,
  deviceType,
  reLaunchGo,
  removeStorageInfo,
  detectionSkipPage,
  detectionDeviceType,
  getTime,
  getTimeData,
  bigLogs
};