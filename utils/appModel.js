/*
 * @Author: lzx
 * @Date: 2022-05-25 13:13:34
 * @LastEditors: lzx
 * @LastEditTime: 2022-06-28 14:41:30
 * @Description: Fuck Bug
 * @FilePath: \reconsitution_talk_vant\utils\appModel.js
 */
/*函数节流*/
const app = getApp()
const disposeDeviceType = () => {
  const userData = wx.getStorageSync('userData');
  if (app.globalData.platform === 'android' || app.globalData.platform === 'ios') {
    switch (appModel || userData.appModel) {
      case 0:
        setTimeout(() => {
          wx.reLaunch({
            url: `/pages/meetingVertical/meetingVertical`
          })
        }, 1000)
        break
      case 1:
        setTimeout(() => {
          wx.reLaunch({
            url: `/pages/meeting/meeting`
          })
        }, 1000)
        break
      default:
        setTimeout(() => {
          wx.reLaunch({
            url: `/pages/meeting/meeting`
          })
        }, 1000)
        break
    }
  } else {
    setTimeout(() => {
      wx.reLaunch({
        url: `/pages/meetingVertical/meetingVertical`
      })
    }, 1000)
  }
}
// export default {
//   disposeDeviceType,
// };
module.exports = {
  disposeDeviceType
}