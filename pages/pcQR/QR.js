const QR = require('../../utils/weapp-qrcode.js')
import tool from '../../utils/tool'
import { getFaceResult } from '../../utils/api/api.js'
Page({
  data: {
    qrcodeURL: "",
    codeText: "",
    verifyStatus: true,
    faceVerifyStatus: false,
    faceToken: '',
    faceUrl: ''
  },
  onLoad: function (options) {
    const faceInfo = wx.getStorageSync('faceVerifyUrl')
    console.log('二维码', faceInfo.faceUrl, options)
    this.setData({
      faceToken: faceInfo.token,
      faceUrl: faceInfo.faceUrl,
      appModel: options.appModel,
      meetingId: options.id,
      userName: options.name,
      userId: options.userId
    })
    this.drawImg(faceInfo.faceUrl);
  },
  setText: function (e) {
    this.setData({
      codeText: e.detail.value
    })
  },
  drawImg: function (url) {
    var imgData = QR.drawImg(url, {
      typeNumber: 4,
      errorCorrectLevel: 'M',
      size: 500
    })
    this.setData({
      qrcodeURL: imgData
    })
    this.getFaceStatus()
  },
  getFaceStatus () {
    let that = this
    let time = setTimeout(() => {
      getFaceResult(that.data.faceToken).then(responses => {
        console.log('完成核验，后端返回', responses.data.data)
        if (responses.data.success) {
          console.log('完成核验', responses.data)
          that.setData({
            verifyStatus: false,
            faceVerifyStatus: true
          })
          clearTimeout(time)
        } else {
          console.log('完成核验error', responses.data)
          if (that.data.verifyStatus) {
            that.getFaceStatus()
          }
        }
      })
    }, 3000);
  },
  onSubmit () {
    let that = this
    // 缓存用户输入的id和名称还有userId-后续用完就清除
    wx.setStorage({
      key: 'user',
      data: {
        id: that.data.meetingId,
        name: that.data.userName,
        userId: that.data.userId
      }
    })
    // 缓存用户输入的id和名称还有userId-持久性缓存一直放在缓存里不清除
    wx.setStorage({
      key: 'userData',
      data: {
        id: that.data.meetingId,
        name: that.data.userName,
        userId: that.data.userId,
        appModel: that.data.appModel
      }
    })
    // 判断用的是啥设备，根据设备类型跳转
    tool.deviceType(that.data.appModel)
  }
})
