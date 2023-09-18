import { startEid } from '../../mp_ecard_sdk/main'
import { verifyMeeting, getFaceResult } from '../../utils/api/api.js'
import Notify from '@vant/weapp/notify/notify'
import Toast from '@vant/weapp/toast/toast'
import tool from '../../utils/tool'
const app = getApp()
const log = require('../../log.js')
//Page Object
Page({
  data: {
    appName: app.globalData.appName, // 登录页的名称
    copyright: app.globalData.copyright, // 登录页的版权
    talk_id: '', //用户输入的谈话id
    username: '', //用户输入的名字
    inviteCode: '', //短信拉起的邀请码
    character: '', //随机生成的字符串
    logo_img: app.globalData.logo_img_url, // 小程序logo
    loginBtn: false,
  },
  onLoad: function (options) {
    let that = this
    // 判断options.inviteCode有没有，没有就说明不是短信拉起，有就是短信拉起就执行登录
    if (options.inviteCode !== undefined) {
      // 短信唤起登录前清空所有缓存
      wx.clearStorageSync()
      // 传递邀请码
      this.setData({
        inviteCode: options.inviteCode
      })
      // 执行登录的loading
      wx.showLoading({
        title: '正在登录...',
        mask: true,
      }).then(() => {
        // 延迟登录给loading个加载时间
        setTimeout(() => {
          // 执行登录（访问登录接口，传参）
          this.loginApi(that.data.talk_id, that.data.username, options.inviteCode)
          // 延迟关闭loading
          setTimeout(() => {
            wx.hideLoading()
          }, 800)
        }, 4000)
      })
      log.info('短信唤起')
    } else if (options.meetingId !== undefined && options.userName !== undefined) {
           console.log("自动拉起,meetingId:", options.meetingId, ",userName:", options.userName)
           // 判断是否企业微信拉起
           // 拉起登录前清空所有缓存
           wx.clearStorageSync()
           this.setData({
             talk_id: options.meetingId,
             username: options.userName
           })
           // 执行登录的loading
           wx.showLoading({
             title: '正在登录...',
             mask: true,
           }).then(() => {
             // 延迟登录给loading个加载时间
             setTimeout(() => {
               // 执行登录（访问登录接口，传参）
               this.loginApi(that.data.talk_id, that.data.username, '')
               // 延迟关闭loading
               setTimeout(() => {
                 wx.hideLoading()
               }, 800)
             }, 4000)
           })
         }
    // 读取用户本地是否有输入过的缓存，有就回显出去
    const userData = wx.getStorageSync('userData')
    if (userData !== '') {
      this.setData({
        talk_id: userData.id,
        username: userData.name
      })
    }
  },
  onShow () {
    app.globalData.socket = false
    tool.removeStorageInfo()
  },
  // 按钮登录
  loginTalk () {
    // 邀请码
    // 禁用按钮
    this.setData({
      loginBtn: true
    })
    // 会议id
    const talk_id = this.data.talk_id
    // 用户姓名
    const username = this.data.username
    // 判断用户是否输入
    if (talk_id === '' || username === '') {
      // 错误提示
      Notify({ type: 'success', message: '请检查您的输入！', safeAreaInsetTop: true })
      // 启用按钮
      this.setData({
        loginBtn: false
      })
      return
    }
    this.loginApi(talk_id, username, '')
  },

  // 访问登录接口
  loginApi (meetingId, username, inviteCode) {
    let that = this
    log.info('访问登录接口参数：' + 'meetingId：' + meetingId + 'username：' + username + 'inviteCode：' + inviteCode)
    verifyMeeting({
      meetingId: meetingId,
      userName: username,
      credential: inviteCode
    }).then(res => {
      // 禁用按钮
      this.setData({
        loginBtn: false
      })
      // 后台返回的code码
      if (res.data.code === 0) {
        if (res.data.data.faceToken === null || res.data.data.faceToken === '') {
          wx.clearStorageSync()// 清空所有缓存
          that.login(res)
        } else {
          // 检查设备是否支持人脸检测
          wx.checkIsSupportFacialRecognition({
            checkAliveType: 2,
            success(result){
              console.log(result)
              if (result.errMsg === "checkIsSupportFacialRecognition:ok") {
              // 请求人脸核身
              wx.startFacialRecognitionVerify({
                name: res.data.data.userName,//姓名
                idCardNumber: res.data.data.idCard, //身份证号
                success(FRresult){
                  console.log('完成核验', FRresult)
                  wx.clearStorageSync()// 清空所有缓存
                  that.login(res) 
                },
                fail(FRresult){
                  const verifyResult=FRresult.verifyResult
                  console.log(verifyResult)
                  wx.showModal({
                    title: '提示',
                    showCancel: false,
                    content: FRresult.errCode+","+FRresult.errMsg,
                  });
                }  
              })
            }
            },
            fail(result){
              // wx.showModal({
              //   title: '提示',
              //   showCancel: false,
              //   content: result.errCode+","+result.errMsg,
              // });
              startEid({
                data: {
                  token: res.data.data.faceToken,
                },
                verifyDoneCallback (face) {
                  const { token, verifyDone } = face;
                  getFaceResult(token).then(responses => {
                    console.log('完成核验，后端返回', responses.data.data)
                    if (responses.data.success) {
                      wx.clearStorageSync()// 清空所有缓存
                      that.login(res)
                    } else {
                      Notify({ type: 'success', message: responses.data.message, safeAreaInsetTop: true })
                    }
                  })
                },
              });
            }
          })
          
          // if(result.errCode!==0 ||FRresult.errCode!==0){
          //   startEid({
          //   data: {
          //     token: res.data.data.faceToken,
          //   },
          //   verifyDoneCallback (face) {
          //     const { token, verifyDone } = face;
          //     getFaceResult(token).then(responses => {
          //       console.log('完成核验，后端返回', responses.data.data)
          //       if (responses.data.success) {
          //         wx.clearStorageSync()// 清空所有缓存
          //         that.login(res)
          //       } else {
          //         Notify({ type: 'success', message: responses.data.message, safeAreaInsetTop: true })
          //       }
          //     })
          //   },
          // });
        // }else return
      }
      } else {
        Notify({ type: 'success', message: res.data.message, safeAreaInsetTop: true })
      }
    }).catch(err => {
      // 如果存在状态码就输出状态码，否则就输出错误
      if (err.statusCode !== undefined) {
        wx.showModal({
          title: `${err.statusCode}`,
          content: '系统繁忙，请稍后再试！',
          showCancel: false,
          cancelColor: '#000000',
          confirmText: '确定',
          confirmColor: '#3CC51F',
          success: (result) => {
            if (result.confirm) {
              // 禁用按钮
              this.setData({
                loginBtn: false
              })
            }
          },
          fail: () => { },
          complete: () => { }
        });
      } else {
        wx.showModal({
          title: '连接失败',
          content: err.errMsg,
          showCancel: false,
          cancelColor: '#000000',
          confirmText: '确定',
          confirmColor: '#3CC51F',
          success: (result) => {
            if (result.confirm) {
              // 禁用按钮
              this.setData({
                loginBtn: false
              })
            }
          },
        });
      }
    })
  },
  login (res) {
    // 	小程序模式：0 - 横屏,1 - 竖屏
    let appModel = res.data.data.appModel
    log.info('小程序模式：0 - 横屏,1 - 竖屏：' + appModel)
    // 自定义加载图标
    Toast.loading({
      message: '加载中...',
      forbidClick: true,
      loadingType: 'spinner',
    })
    // 缓存用户输入的id和名称还有userId-后续用完就清除
    wx.setStorage({
      key: 'user',
      data: {
        id: res.data.data.meetingId,
        name: res.data.data.userName,
        userId: res.data.data.userId
      }
    })
    // 缓存用户输入的id和名称还有userId-持久性缓存一直放在缓存里不清除
    wx.setStorage({
      key: 'userData',
      data: {
        id: res.data.data.meetingId,
        name: res.data.data.userName,
        userId: res.data.data.userId,
        appModel: appModel
      }
    })
    // 判断用的是啥设备，根据设备类型跳转
    tool.deviceType(appModel)
  },
  getInputId (event) {
    // event.detail 为当前输入的值
    // 将用户输入的会议id传递出去
    // 正则表达式设置只能输数字和去掉空格
    this.setData({
      talk_id: event.detail.value.trim().replace(/[^0-9]/g, "")
    })
  },
  getInputName (event) {
    // event.detail 为当前输入的值
    // 将用户输入的名字传递出去
    // 真实姓名的输入内容，不能输入特殊字符
    this.setData({
      username: event.detail.value.trim().replace(/[^0-9a-zA-Z·\u4e00-\u9fa5]/g, "")
    })
  },
  // 前端生成一个随机32位字符串（暂时弃用）
  randomString () {
    let len = 32;
    let chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    let maxPos = chars.length;
    let character = '';
    for (let i = 0; i < len; i++) {
      character += chars.charAt(Math.floor(Math.random() * maxPos))
    }
    this.setData({
      character: character
    })
  },
  // 分享
  onShareAppMessage () {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },
  //用户点击右上角分享朋友圈
  onShareTimeline () {
    return {
      title: app.globalData.appName,
    }
  },
});