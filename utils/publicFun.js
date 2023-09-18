/*
 * @Author: lzx
 * @Date: 2022-04-28 14:06:27
 * @LastEditors: lzx
 * @LastEditTime: 2022-04-29 15:12:53
 * @Description: Fuck Bug
 * @FilePath: \reconsitution_talk_vant\utils\publicFun.js
 * 会议页面的方法封装（等后面有时间在处理吧！）
 */
/**
 * socket相关的方法
 */
const webSocket = require('./socket')
const log = require('../log.js')
// socket加入
const socketJoin = () => {
  console.log('加入')
}
// socket离会
const socketLeave = () => {
  console.log('加入')
}
// socket解散
const socketDismiss = () => {
  console.log('加入')
}
// socket笔录检验
const socketNoteCheck = () => {
  console.log('加入')
}
// socket笔录签名
const socketNoteSignName = () => {
  console.log('加入')
}
// socket分组
const socketGroup = () => {
  console.log('加入')
}
/**
 * 页面一些方法
 */
// 加入会议
// 去掉登录的相关缓存
const removeStorageInfo = () => {
  log.info('去掉登录的相关缓存');
  // 清除本地缓存的user
  wx.removeStorageSync('user')
  wx.removeStorageSync('options')
  wx.removeStorageSync('WsInfo')
}

// 退出会议
const closeMeeting = (data) => {
  wx.showModal({
    title: '退出谈话',
    content: '是否退出本次谈话',
    success(res) {
      if (res.confirm) {
        // 关闭loading
        wx.showLoading({
          title: '正在退出...',
          mask: true
        }).then(() => {
          // 调用退出会议接口
          outMeeting({
            orderId: data.orderId,
            userId: data.userId
          }).then(res => {
            // 调用关闭webSocket
            webSocket.closeSocket();
            // 调用清除缓存
            removeStorageInfo()
            // 关闭loading
            wx.hideLoading()
            log.error('用户主动退出谈话');
            // 转到登录
            wx.reLaunch({
              url: '/pages/index/index'
            })
          })
        }).catch(err => {
          // 调用关闭webSocket
          webSocket.closeSocket();
          // 调用清除缓存
          removeStorageInfo()
          // 关闭loading
          wx.hideLoading()
          // 转到登录
          wx.reLaunch({
            url: '/pages/index/index'
          })
        })
      } else if (res.cancel) {
        wx.showToast({
          title: '已取消退出',
          icon: 'error',
          duration: 2000,
          mask: true,
        })
      }
    }
  })
}
// 解散会议
const dissolveMeeting = () => {
  // 退出的loading
  wx.showLoading({
    title: '正在退出...',
    mask: true
  }).then(() => {
    // 调用关闭webSocket
    webSocket.closeSocket();
    // 调用清除缓存
    removeStorageInfo()
    // 延迟关闭加载和跳转登录
    setTimeout(() => {
      // 关闭loading
      wx.hideLoading()
      // 转到登录
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }, 1500)
  })
}
//将封装的方法暴露出去
module.exports = {
  socketJoin,
  socketLeave,
  socketDismiss,
  socketNoteCheck,
  socketNoteSignName,
  socketGroup,
  removeStorageInfo,
  closeMeeting,
  dissolveMeeting
}