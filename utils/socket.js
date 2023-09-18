const log = require('../log.js')
// socket已经连接成功
let socketOpen = false;
// socket已经调用关闭function
let socketClose = false;
// socket发送的消息队列
let socketMsgQueue = [];
// 判断心跳变量
let heart = '';
// 心跳失败次数
let heartBeatFailCount = 0;
// 终止心跳
let heartBeatTimeOut = null;
// 终止重新连接
let connectSocketTimeOut = null;
const hearTime = 3000;
let reconnection = 0;
const app = getApp();
let webSocket = {
  /**
   * 创建一个 WebSocket 连接
   * @param {orderId, userId}
   *   url        String  是  开发者服务器接口地址，必须是 wss 协议，且域名必须是后台配置的合法域名
   *   header      Object  否  HTTP Header , header 中不能设置 Referer
   *   method      String  否  默认是GET，有效值：OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, CONNECT
   *   protocols  StringArray  否  子协议数组  1.4.0
   *   success    Function  否  接口调用成功的回调函数
   *   fail      Function  否  接口调用失败的回调函数
   *   complete    Function  否  接口调用结束的回调函数（调用成功、失败都会执行）
   */
  connectSocket: function (orderId, userId) {
    let info = wx.getStorageSync('WsInfo')
    const meetingOrderId = orderId || info.orderId // 会议的orderId
    const meetingUserId = userId || info.userId // 会议的userId
    wx.showLoading({
      title: '正在连接服务...',
      mask: false,
    });
    socketOpen = false;
    socketClose = false;
    socketMsgQueue = [];
    wx.connectSocket({
      url: `${app.globalData.websocketUrl}?orderId=${meetingOrderId}&userId=${meetingUserId}`,
      success: function (res) {
        console.log('socket创建' + JSON.stringify(res))
        log.info('socket创建' + JSON.stringify(res))
      },
      fail: function (err) {
        console.log(err);
        log.error('socket连接失败' + err)
      }
    })
  },

  /**
   * 通过 WebSocket 连接发送数据
   * @param {options}
   *   data  String / ArrayBuffer  是  需要发送的内容
   *   success  Function  否  接口调用成功的回调函数
   *   fail  Function  否  接口调用失败的回调函数
   *   complete  Function  否  接口调用结束的回调函数（调用成功、失败都会执行）
   */
  sendSocketMessage: function (options) {
    if (socketOpen) {
      wx.sendSocketMessage({
        data: options.msg,
        success: function (res) {
          if (options) {
            options.success && options.success(res);
          }
        },
        fail: function (res) {
          if (options) {
            options.fail && options.fail(res);
          }
        }
      })
    } else {
      socketMsgQueue.push(options.msg)
    }
  },

  /**
   * 关闭 WebSocket 连接。
   * @param {options}
   *   code  Number  否  一个数字值表示关闭连接的状态号，表示连接被关闭的原因。如果这个参数没有被指定，默认的取值是1000 （表示正常连接关闭）
   *   reason  String  否  一个可读的字符串，表示连接被关闭的原因。这个字符串必须是不长于123字节的UTF-8 文本（不是字符）
   *   fail  Function  否  接口调用失败的回调函数
   *   complete  Function  否  接口调用结束的回调函数（调用成功、失败都会执行）
   */
  closeSocket: function (options) {
    if (connectSocketTimeOut) {
      clearTimeout(connectSocketTimeOut);
      connectSocketTimeOut = null;
    }
    socketClose = true;
    var self = this;
    self.stopHeartBeat();
    wx.closeSocket({
      success: function (res) {
        log.info('WebSocket 关闭成功！' + JSON.stringify(res));
        console.log('socket关闭方法,关闭成功！', res)
      },
      fail: function (err) {
        log.info('WebSocket 关闭失败！' + JSON.stringify(err));
        console.log('socket关闭方法,关闭失败！', err)
      }
    })
  },

  // 收到消息回调
  onSocketMessageCallback: function (msg) {
  },

  // 开始心跳
  startHeartBeat: function () {
    console.log('socket开始心跳')
    log.debug('socket开始心跳');
    var self = this;
    heart = 'heart';
    this.heartBeat();
  },

  // 结束心跳
  stopHeartBeat: function () {
    console.log('socket结束心跳')
    log.debug('socket结束心跳');
    heart = '';
    if (heartBeatTimeOut) {
      clearTimeout(heartBeatTimeOut);
      heartBeatTimeOut = null;
    }
    if (connectSocketTimeOut) {
      clearTimeout(connectSocketTimeOut);
      connectSocketTimeOut = null;
    }
  },

  // 心跳
  heartBeat: function () {
    var self = this;
    if (!heart) {
      return;
    }
    self.sendSocketMessage({
      msg: JSON.stringify({
        type: 'heartbeat',
        content: '',
        requestId: ''
      }),
      success: function (res) {
        // console.log('socket心跳成功');
        if (heart) {
          heartBeatTimeOut = setTimeout(() => {
            self.heartBeat();
          }, hearTime);
        }
      },
      fail: function (res) {
        // console.log('socket心跳失败');
        if (heartBeatFailCount < 3) {
          // 重连
          self.connectSocket();
        }
        if (heart) {
          heartBeatTimeOut = setTimeout(() => {
            self.heartBeat();
          }, hearTime);
        }
        heartBeatFailCount++;
      },
    });
  }
};
// 监听WebSocket连接打开事件。callback 回调函数
wx.onSocketOpen(function (res) {
  console.log('WebSocket连接已打开！')
  log.info('WebSocket连接已打开！');
  setTimeout(() => {
    wx.hideLoading()
  }, 500);
  // 如果已经调用过关闭function
  if (socketClose) {
    webSocket.closeSocket();
  } else {
    socketOpen = true
    for (var i = 0; i < socketMsgQueue.length; i++) {
      webSocket.sendSocketMessage(socketMsgQueue[i])
    }
    socketMsgQueue = []
    webSocket.startHeartBeat();
    app.globalData.socket = socketOpen
    heartBeatFailCount = 0
    heartBeatTimeOut = null
    reconnection = 0
  }
})

// 监听WebSocket错误。
wx.onSocketError(function (res) {
  console.log('WebSocket连接打开失败，请检查！', res)
  log.error('WebSocket连接打开失败，请检查！', res)
  app.globalData.socket = socketOpen
  // 错误重连
  if (reconnection <= 2) {
    wx.showLoading({
      title: `连接服务：${reconnection + 1}次`,
      mask: false,
    })
    console.log('socket错误重连' + reconnection)
    log.error('socket错误重连' + reconnection)
    clearTimeout(connectSocketTimeOut)
    connectSocketTimeOut = setTimeout(() => {
      webSocket.connectSocket();
      reconnection++
    }, hearTime);
  } else {
    wx.showToast({
      title: '重连失败',
      icon: 'error',
      duration: 1500,
      mask: false,
    });
    console.log('WebSocket连接打开失败，回到登录！', res)
    // 调用关闭webSocket
    webSocket.closeSocket();
    reconnection = 0
    // 清除本地缓存的user
    wx.removeStorageSync('user')
    wx.removeStorageSync('options')
    // 延迟关闭加载和跳转登录
    setTimeout(() => {
      // 转到登录
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }, 1500)
  }
})

// 监听WebSocket接受到服务器的消息事件。
wx.onSocketMessage(function (res) {
  webSocket.onSocketMessageCallback(res.data)
})

// 监听WebSocket关闭。
wx.onSocketClose(function (res) {
  console.log('WebSocket 已关闭！', res)
  log.info('WebSocket 已关闭！', res)
  if (!socketClose) {
    if (reconnection <= 2) {
      clearTimeout(connectSocketTimeOut)
      connectSocketTimeOut = setTimeout(() => {
        webSocket.connectSocket();
        reconnection++
      }, hearTime);
    }
  }
})

module.exports = webSocket;