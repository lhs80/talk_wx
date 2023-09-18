
import { checkConfirm, uploadBase64 } from '../../utils/api/api.js'
const log = require('../../log.js')
const app = getApp()
Component({
  data: {
    signNameBtn: false, // 签名提交按钮
    isStart: false,// 判断是否开始绘画
    noteCheckList: [], // 笔录图片
    noteCheck: false, // 笔录是否显示
    userSignature: false, // 签名画板是否显示
    noteCheckBtn: true, //确认笔录按钮
    noteSignBtn: false, //签名按钮
    noteCheckListRandom: '', // 时间戳用于渲染图片
    live_push_name: '', // 用户姓名
    meetingId: '',
    userId: ''
  },
  properties: {
    parms: {
      // type: Object
    }
  },
  ready() {
    let userInfo = wx.getStorageInfoSync('user');
    let parms = this.data.parms
    // console.log(this.data.parms)
    this.setData({
      noteCheck: parms.noteCheck,
      noteCheckBtn: parms.noteCheckBtn,
      noteCheckListRandom: parms.noteCheckListRandom,
      noteCheckList: parms.noteCheckList,
      noteSignBtn: parms.noteSignBtn,
      meetingId: parms.meetingId,
      userId: parms.userId,
      live_push_name: userInfo
    })
    console.log(parms)
    // 创建画板
    this.mycanvas = wx.createCanvasContext("canvas", this);
  },
  methods: {
    // 绘画开始
    canvasStart: function (e) {
      // 设置线的样式
      this.mycanvas.setLineCap("round");
      this.mycanvas.setLineJoin("round");
      // 初始化颜色
      this.mycanvas.setStrokeStyle("#000000");
      // 初始化粗细
      this.mycanvas.setLineWidth(6);
      // 获取触摸点的x，y位置
      let x = e.touches[0].x
      let y = e.touches[0].y

      // 将画笔移动到指定坐标
      this.mycanvas.moveTo(x, y)
    },
    // 绘画进行中
    canvasMove: function (e) {
      // 获取移动过程中的x,y位置
      let x = e.touches[0].x
      let y = e.touches[0].y
      // 指定移动的位置
      this.mycanvas.lineTo(x, y)
      // 开始画线
      this.mycanvas.stroke()
      // 将绘画绘制到canvas
      this.mycanvas.draw(true)
      // 绘制完成，将起始点进行移动
      this.mycanvas.moveTo(x, y)
    },
    // 绘画结束
    canvasEnd: function () {
      // 判断是否开始绘画
      this.setData({
        isStart: true
      });
    },
    // 清除画板
    clearCanvas: function () {
      // 清除区域
      this.mycanvas.clearRect(0, 0, 1000, 1000);
      this.mycanvas.draw(true);
      // 清除画板后将绘画状态改掉
      this.setData({
        isStart: false
      })
    },
    // 确认笔录
    noteCheckSubmit() {
      let that = this //解决一下this
      wx.showModal({
        title: '笔录确认',
        content: '您是否确认笔录！',
        success(res) {
          if (res.confirm) {
            checkConfirm({
              meetingId: that.data.meetingId,
              userId: that.data.userId
            }).then(res => {
              console.log(res)
              log.info('用户' + that.data.live_push_name + '确认笔录:' + JSON.stringify(res));
              wx.showToast({
                title: '确认成功',
                icon: 'success',
                duration: 2000
              })
              that.setData({
                noteCheck: false
              })
              that.noteCheckSignName()
            })
          } else if (res.cancel) {
            that.noteCheckSignName()
            log.warn('用户' + that.data.live_push_name + '取消确认笔录');
            wx.showToast({
              title: '您已取消',
              icon: 'error',
              duration: 2000
            })
          }
        }
      })
    },
    // 取消确认笔录
    noteCheckClose() {
      this.setData({
        noteCheck: false
      })
      this.noteCheckSignName()
    },
    // 确认签名按钮
  noteSignSubmit() {
    log.info('用户: ' + this.data.live_push_name + '确认签名');
    this.setData({
      noteCheck: false,
      userSignature: true
    })
  },
  // 取消确认签名
  noteSignClose() {
    this.setData({
      noteCheck: false
    })
    this.noteCheckSignName()
  },
    // 提交签名
    submitSignature() {
      // console.log(this.mycanvas)
      // console.log(this.mycanvas.path)
      // 新需求THX-809（可以用canvas的path判断长度，但是觉得不保险，所以用绘画状态判断）
      if (!this.data.isStart) {
        wx.showToast({
          title: '请先签名再提交！',
          icon: 'error',
          duration: 2000
        })
        return
      }
      log.info('用户: ' + this.data.live_push_name + '点击提交签名');
      // 禁用按钮
      this.setData({
        signNameBtn: true
      })
      let that = this
      wx.canvasToTempFilePath({
        canvasId: 'canvas',
        fileType: 'png',
        success(res) {
          const base64 = wx.getFileSystemManager().readFileSync(res.tempFilePath, "base64");
          let param = {
            fileData: base64,
            meetingId: that.data.meetingId,
            userId: that.data.userId
          }
          uploadBase64(param).then(res => {
            log.info('用户: ' + that.data.live_push_name + '签名提交成功' + JSON.stringify(res));
            wx.showToast({
              title: '签名成功！',
              icon: 'success',
              duration: 2000
            }).then(res => {
              setTimeout(() => {
                that.setData({
                  userSignature: false,
                  noteCheck: false,
                  signNameBtn: false
                })
                that.noteCheckSignName()
              }, 1000)
            })
          }).catch(err => {
            log.error('用户: ' + that.data.live_push_name + '签名提交失败' + JSON.stringify(err));
            wx.showToast({
              title: '签名失败！',
              icon: 'error',
              duration: 2000
            }).then(res => {
              setTimeout(() => {
                // 开启按钮
                that.setData({
                  signNameBtn: false
                })
                that.noteCheckSignName()
              }, 1000)
            })
          })
          // 老接口，在PC上无法上传（有点兼容性问题，更换Base64）
          // wx.uploadFile({
          //   url: app.globalData.baseUrl + `/meeting/sign/upload/${that.data.meetingId}/${that.data.userId}`,
          //   filePath: res.tempFilePath,
          //   name: 'file',
          //   header: {
          //     "Content-Type": "multipart/form-data"
          //   },
          //   success(res) {
          //     console.log(res)
          //     log.info('用户: ' + that.data.live_push_name + '签名提交成功' + JSON.stringify(res.data));
          //     wx.showToast({
          //       title: '签名成功！',
          //       icon: 'success',
          //       duration: 2000
          //     }).then(res => {
          //       setTimeout(() => {
          //         that.setData({
          //           userSignature: false,
          //           noteCheck: false,
          //           signNameBtn: false
          //         })
          //         that.noteCheckSignName()
          //       }, 1000)
          //     })
          //   },
          //   fail(err) {
          //     log.error('用户: ' + that.data.live_push_name + '签名提交失败' + JSON.stringify(err));
          //     wx.showToast({
          //       title: '签名失败！',
          //       icon: 'error',
          //       duration: 2000
          //     }).then(res => {
          //       setTimeout(() => {
          //         // 开启按钮
          //         that.setData({
          //           signNameBtn: false
          //         })
          //         that.noteCheckSignName()
          //       }, 1000)
          //     })
          //   }
          // })
        }
      }, this)
    },
    // 取消签名
    cancelSignature() {
      this.setData({
        userSignature: false,
        noteCheck: false
      })
      this.noteCheckSignName()
    },
    noteCheckSignName (parms) {
      this.triggerEvent('noteCheckSignName', false) //通过triggerEvent将参数传给父组件
    }
  }
})