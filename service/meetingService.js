/***************************************************************
 * 信令服务
 ***************************************************************/
const MAX_TRY_TIMES = 3; //最多重连次数
const RETRY_TIMEOUT = 5000; //重新连接间隔时长
const HEAR_BEAT_TIMEOUT = 5000; //websocket心跳超时时间
const app = getApp();
const eventBus = app.globalData.bus;
const log = require('../log.js');
const curUserName = wx.getStorageSync('user').name;

function LocalService(url, connectStatus, getMessage, onFaild) {
  this.ws = null;
  this.url = url;
  this.connectStatus = connectStatus;
  this.getMessage = getMessage;
  this.onFaild = onFaild;
  this.canReconnect = true;

  if (typeof WebSocket !== undefined) {
    this.connect.call(this, this.ws, this.url);
  }
}

LocalService.prototype = {
  timeoutObj: null, //发送心跳定时器
  serverTimeoutObj: null, //服务器回复心跳的定时器
  resetTimeout: null, //重连定时器
  lockReconnect: null, //重连开关
  reconnectTimes: 0, //重连次数
  connect: function (ws, url) {
    let that = this;
    this.ws = wx.connectSocket({
      url,
      success: function (res) {
        that.ws = res.socketTaskId;
        log.info(`${curUserName || ''}:websocket创建` + JSON.stringify(res));
        console.log(`${curUserName || ''}:websocket创建` + JSON.stringify(res))
      },
      fail: function (err) {
        log.error(`${curUserName}:websocket连接失败` + err)
      }
    });
    //连接打开
    wx.onSocketOpen((response) => {
      that.reset().start();
      if (that.connectStatus) {
        that.connectStatus(0); //通知前台websocket连接成功
      }
    });

    //连接关闭
    wx.onSocketClose((eve) => {
      console.error(`===================websocket断开==========================`);
      console.log(`code:${eve.code}`);
      console.log(`wasClean:${eve.wasClean}`);
      console.log(`可以重连吗:${that.canReconnect}`);
      console.error(`===================websocket断开=========================`);
      //通知前台websocket连接关闭
      if (that.connectStatus) {
        that.connectStatus(-1);
      }
      //重新连接
      if (that.canReconnect) that.reconnect();
    });

    //连接错误
    wx.onSocketError((eve) => {
      that.reconnect();
    });

    //接收消息
    wx.onSocketMessage((message) => {
      // 收心跳回复消息时，重置发送心跳定时器。其它的消息不重置
      if (JSON.parse(message.data).type === "heartbeat") {
        that.reset().start();
      }

      if (message) {
        if (that.getMessage) {
          that.getMessage(message.data);
        }
      }
    });
  },
  start: function () {
    let that = this;
    this.timeoutObj && clearTimeout(this.timeoutObj);
    this.serverTimeoutObj && clearTimeout(this.serverTimeoutObj);
    //发送一个心跳，后端收到后，返回一个心跳消息，
    this.timeoutObj = setTimeout(function () {
      let msg = JSON.stringify({
        type: "heartbeat",
        content: "",
        requestId: "",
      });
      that.sendMessage(msg);
      //等待服务器回复，如果超过3秒没有回复，关闭websocket，设置可重连开关为true;
      that.serverTimeoutObj = setTimeout(() => {
        that.canReconnect = true;
        that.ws.close();
      }, HEAR_BEAT_TIMEOUT);
    }, HEAR_BEAT_TIMEOUT);
  },
  //本地服务重连
  reconnect: function () {
    clearTimeout(this.resetTimeout); //清空重连定时器
    try {
      //如果已经在重连，则返回;
      if (this.lockReconnect) return;
      //如果连接的次数大于允许次数，
      if (this.reconnectTimes < MAX_TRY_TIMES) {
        this.reconnectTimes++; //重连次数+1
        this.lockReconnect = true; //打开重连开关;
        log.info(`${curUserName || ''} | websocket消息-第${this.reconnectTimes}次重连`);
        console.log(`>>>>>>>>>>>>>>>>>>>第${this.reconnectTimes}次重连<<<<<<<<<<<<<<<<<<`);
        this.resetTimeout = setTimeout(() => {
          this.connect(this.ws, this.url);
          this.lockReconnect = false; //关闭重连开关;
        }, RETRY_TIMEOUT);
      } else {
        this.onFaild(); //通知会议连接失败；
        if (this.connectStatus) {
          this.connectStatus(-2); //打印控制台消息，信令服务连接尝试连接次数已用完，连接失败；
        }
      }
    } catch (err) {
      this.resetTimeout = setTimeout(() => {
        this.connect(this.ws, this.url);
        this.lockReconnect = false;
      }, RETRY_TIMEOUT);
    }
    return this;
  },
  reset: function () {
    clearTimeout(this.timeoutObj);
    clearTimeout(this.serverTimeoutObj);
    return this;
  },
  close: function () {
    if (this.ws) {
      this.canReconnect = false;
      clearTimeout(this.timeoutObj);
      clearTimeout(this.serverTimeoutObj);
      wx.closeSocket();
    }
  },
  sendMessage: function (message) {
    if (this.ws && this.ws.readyState === 1) {
      wx.sendSocketMessage({
        data: message
      });
    } else {
      log.error(`${curUserName || ''}:websocket发送消息失败。`);
      console.error("kead_collect ==> rtcSerive | localService | sendMessage  => ws failed");
    }
  },
};

export default class MeetingService {
  //信令服务
  static meetingService;

  //初始化信令服务
  static init(wsUrl, onFaild) {
    MeetingService.meetingService = new LocalService(
      wsUrl,
      (status) => {
        if (status === 0) {
          log.info(`${curUserName || ''}:MeetingService | init | 信令服务连接成功`);
          console.log("MeetingService | init | 信令服务连接成功");
        } else if (status === -1) {
          log.info(`${curUserName || ''}:MeetingService | init | 信令服务已关闭`);
          console.log("MeetingService | init | 信令服务已关闭");
        } else if (status === -2) {
          log.info(`${curUserName || ''}:MeetingService | init | 信令服务连接尝试连接次数已用完，连接失败`);
          console.log("MeetingService | init | 信令服务连接尝试连接次数已用完，连接失败");
        }
      },
      MeetingService.messageListener,
      onFaild
    );
  }

  static logout() {
    log.info(`${curUserName || ''}:MeetingService | logout | 主动关闭`);
    if (MeetingService.meetingService) MeetingService.meetingService.close();
  }

  //信令服务消息接受
  static messageListener(message) {
    if (message === "连接成功") {
      log.info(`${curUserName || ''}:MeetingService | messageListener | 连接成功`);
      MeetingService.ConnectSuccess();
    } else {
      let messageStr = message.replace(/(\\)/g, "");
      messageStr = messageStr.replace(/\"\{/g, "{");
      messageStr = messageStr.replace(/\}\"/g, "}");
      const messageJson = JSON.parse(messageStr);
      if (messageJson.type) {
        // log.info(`MeetingService | ${JSON.stringify(messageJson.type)}:${JSON.stringify(messageJson)}`);
        switch (messageJson.type) {
          case "join": //加入谈话
            MeetingService.JoinRoom(messageJson);
            break;
          case "chat_init": //离线聊天信息
            let datas = {
              content: [],
              newMessageNumber: 0,
              groupId: -1
            };
            messageJson.content.forEach((item) => {
              if (item.groupName === '全部') {//小程序只显示"全部"分组里的内容
                const {chatContent, groupId} = item;
                // datas.content.concat([...chatContent.historyMessage, ...chatContent.newMessages]);
                datas.content = datas.content.concat(chatContent.historyMessage, chatContent.newMessages);
                datas.groupId = groupId;
                datas.newMessageNumber += chatContent.newMessages.length;
              }
            });
            MeetingService.ChatInit(datas);
            break;
          case "dismiss": //主持人退出谈话
            MeetingService.LeaveRoom(messageJson);
            break;
          case "leave": //结束谈话
            MeetingService.QuitRoom(messageJson);
            break;
          case "screen_sharing": //启动桌面分享
            MeetingService.ShareScreenStart(messageJson);
            break;
          case "share_screen_close": //关闭桌面分享
            MeetingService.ShareScreenClose(messageJson);
            break;
          case "note_check": //笔录核对
            MeetingService.NoteCheck(messageJson);
            break;
          case "note_sign": //笔录签名
            MeetingService.NoteCheck(messageJson);
            break;
          case "note_sign_confirm": //笔录签名确认
            MeetingService.NoteSignConfirm(messageJson);
            break;
          case "media_enable": //禁音通知
            MeetingService.memberMuteNotify(messageJson);
            break;
          case "kmedia_pull_error": //接收服务端发送的拉流异常消息
            MeetingService.kmediaErrorPullNotify(messageJson);
            break;
          case "kmedia_push_error": //接收服务端发送的推流异常消息
            MeetingService.kmediaErrorPushNotify(messageJson);
            break;
          case "init": //接收服务端初始化的数据用于谈话解散后连接异常
            MeetingService.errorEndMeeting(messageJson);
            break;
          case "chat": //解析聊天内容
            let {content} = messageJson;
            const msgObj = {
              content: content.content,
              sendUserId: content.sendUserId,
              sendUserName: content.sendUserName,
              receiveUserId: content.receiveUserId,
              receiveUserName: content.receiveUserName,
              groupId: content.groupId,
            };
            MeetingService.chatMessageHandler(msgObj);
            break;
          case "recorder_metastasis": //转移记录人
            MeetingService.recorderMetastasis(messageJson);
            break;
          case "record_status": //是否开始录像
            MeetingService.recordStatusChange(messageJson);
            break;
          case "meeting_info_changed": //修改姓名
            MeetingService.meetingInfoChange(messageJson);
            break;
          case "member_info_changed": //小程序闭麦开麦通知
            MeetingService.memberInfoChange(messageJson);
            break;
          case "file_update": //允许参与人上传材料
            MeetingService.notice(messageJson);
            break;
          case "member_user_changed": //接入法庭
            MeetingService.joinCourt(messageJson);
            break;
          case "screen_sharing_V3.0": //共享屏幕
            MeetingService.ShareScreen(messageJson);
            break;
          case 'user_group_info'://禁听
            MeetingService.setGroupInfo(messageJson);
            break;
          case 'camera_turn'://翻转摄像头
            MeetingService.setCameraTurn(messageJson);
            break;
          case "meeting_main_screen_changed": //设置主画面
            MeetingService.mainScreenChange(messageJson);
            break;
          default:
            break;
        }
      }
    }
  }

  static ConnectSuccess() {
    eventBus.emit("connect_success");
  }

  //禁听
  static setGroupInfo(data) {
    eventBus.emit("user_group_info", data);
  }

  //翻转摄像头
  static setCameraTurn(data) {
    eventBus.emit("camera_turn", data);
  }

  //用户加入谈话
  static JoinRoom(data) {
    const {userList} = data.content;
    eventBus.emit("user_joined", {
      detail: data.content,
    });
  }

  //主持人退出谈话
  static LeaveRoom(data) {
    // log.info("websocket消息-解散会议：dismiss_room" + JSON.stringify(data.content));
    let {userId} = data.content;
    eventBus.emit("dismiss_room", {
      detail: {
        leaveId: userId,
      },
    });
  }

  //其它用户退出谈话
  static QuitRoom(data) {
    eventBus.emit("quit_room", {
      detail: {
        leaveId: data.content.userId,
        userName: data.content.userName,
        quitMessage: data.content.quitMessage, //退出消息
      },
    })
  }

  //记录人变换
  static recorderMetastasis(data) {
    eventBus.emit("recorder_change", {
      detail: {
        messages: data.content,
      },
    })
  }

  //启动桌面分享
  static ShareScreenStart(data) {
    eventBus.emit("share_screen", {
      detail: {
        messages: data.content,
      },
    })
  } //共享屏幕
  static ShareScreen(data) {
    const {meetingCache} = data.content;
    eventBus.emit("screen_sharing_V3.0", {
      detail: meetingCache,
    });
  }

  //笔录核对
  static NoteCheck(data) {
    eventBus.emit(data.type, data)
  }

  //笔录签名确认
  static NoteSignConfirm(data) {
    eventBus.emit(data.type, {
      detail: {
        messages: data.content,
      },
    })
  }

  //成员静音通知
  static memberMuteNotify(data) {
    const content = data.content;
    eventBus.emit("mute_member", {
      detail: {
        ...content,
      },
    })
  }

  //接收服务端发送的音视频异常消息
  static kmediaErrorPullNotify(data) {
    if (window.meeting && window.meeting.roomInfo) {
      if (window.meeting.roomInfo.roomId === data.meetingId) {
        const msgContent = data.msgContent;
      }
    }
  }

  static kmediaErrorPushNotify(data) {
    if (window.meeting && window.meeting.roomInfo) {
      if (window.meeting.roomInfo.roomId === data.meetingId) {
        const msgContent = data.msgContent;
      }
    }
  }

  //聊天发送
  static sendMsg(msg) {
    if (MeetingService.meetingService) {
      MeetingService.meetingService.sendMessage(msg);
    }
  }

  static ChatInit(msgData) {
    eventBus.emit("chat_init", msgData)
  }

  /**
   * 聊天消息接收
   * **/
  static chatMessageHandler(msgData) {
    eventBus.emit("receive_message", {
      detail: {
        messages: msgData,
      },
    })
  }

  // 收到初始化websocket消息，目前仅为用作重连1006的操作
  static errorEndMeeting(data) {
    // if (data.content.code === 1006) {
      eventBus.emit("init",data)
    // }
  }

  /**
   * 录像状态改变
   * **/
  static recordStatusChange(data) {
    eventBus.emit(data.type, {
      detail: data.content,
    })
  }

  /**
   * 修改姓名
   * **/
  static meetingInfoChange(data) {
    eventBus.emit(data.type, {
      detail: data.content,
    })
  }

  /**
   * 小程序闭麦开麦
   * **/
  static memberInfoChange(data) {
    eventBus.emit(data.type);
  }

  /**
   * 允许上传材
   * **/
  static notice(data) {
    eventBus.emit(data.type, {
      detail: data.content,
    })
  }

  //接入法庭中的席位
  static joinCourt(data) {
    const {meetingCache} = data.content;
    eventBus.emit("member_user_changed", {
      detail: meetingCache,
    })
  }
  /**
   * 主屏幕变化
   * **/
  static mainScreenChange(data) {
    eventBus.emit("main_screen_change", {
        detail: data.content,
      });
  }
}
