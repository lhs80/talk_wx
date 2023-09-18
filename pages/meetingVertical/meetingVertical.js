// pages/meeting/meeting.js
import {
  joinMeetingFun,
  outMeeting,
  uploadingImg,
  userGetNote,
  setMicStatus
} from '../../utils/api/api.js'

import Notify from '@vant/weapp/notify/notify'
import tool2 from '../../utils/tool'
import {baseURL} from '../../utils/api/config'
import MeetingService from '../../service/meetingService'

const log = require('../../log.js');
const app = getApp();
const eventBus = app.globalData.bus;
Page({
  data: {
    isHide:false,
    userId: '',
    meetingId: '',//
    username: '', //用户输入的姓名
    menuStatus: true,// 设备类型
    meetingInfo: {},
    attendList: [],
    courtSeatList: [],
    mineInfo: {},
    hostInfo: {},//主持人数据
    homeScreenId: -1,//切换全屏显示的用户
    signNameDialog: false, // 笔录和画板显示
    showChatDialog: false, // 聊天框
    showNewMsgTip: false,//新消息提示浮窗；
    chatInfo: {},
    chatMsgContent: '', // 聊天框内容
    soundMode: 'speaker', // 扬声器||听筒
    isGetNote: true,
    noteCheckParams: {}, // 传给笔录签名组件的参数
    voiceShow: true, //听筒扬声器图标的互换
    enableMic: true, //开启或关闭麦克风
    private_chat: false,
    reconnection: 0, // 重连次数
    bangScreenInfo: app.globalData.bangScreenInfo,
    platform:'',//运行平台
    chatInputBottom:0,//聊天输入框距离底部的距离
    showToast:false,//上传文件选择文件类型的提示框
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log("onload")
    let appType = wx.getStorageSync('userData');
    if (appType.appModel === 1) {
      wx.reLaunch({
        url: '/pages/meeting/meeting'
      });
    }
    // 获取登录缓存（没有用跳转传值）
    const UserStorage = wx.getStorageSync('user');
    //
    // 判断是否登录的缓存，没有缓存就跳转登录
    if (UserStorage !== '') {
      let platform = tool2.detectionDeviceType().platform;
      this.setData({
        platform
      });
      // 将登录数据传递出去
      this.setData({
        meetingId: UserStorage.id,
        userId: UserStorage.userId,
        username: UserStorage.name,
        menuStatus: !(platform === 'windows' || platform === 'devtools' || platform === 'mac') // 设备类型
      });
      log.info('用户:' + UserStorage.name + '平台:'+platform);
      // 执行加入会议请求
      this.joinMeeting();
    } else {
      wx.hideLoading();
      tool2.detectionSkipPage();// 检测设备跳转到登录页
    }
  },
  onHide() {
    log.info('用户:' + this.data.mineInfo.alias + '进入后台');
    console.log('用户:' + this.data.mineInfo.alias + '进入后台');
    this.setData({
      isHide:true
    })
  },
  onShow() {
    let that=this;
    this.setData({
      signNameDialog: false
    })
    //用户从最小化窗口恢复时
    if(this.data.isHide){
      log.info('用户:' + this.data.username + '返回会议');
      console.log('用户:' + this.data.username + '返回会议');
      let tempAttendList=this.data.attendList;
      this.setData({
        attendList:[]
      });
      console.log("onShow clear",this.data.attendList);
      setTimeout(()=>{
        //小程序切入后台再返回前台后，有概率出来不拉流不推流的情况，在这里进行数据重置，触发页面组件重新渲染，重新启动推拉流
        that.setData({
          attendList:tempAttendList,
          isHide:false
        });
        //在IOS系统上，小程序切入后台再返回前台时，会出现打开静音状态不生效的问题；经测试发现，切换扬声器后，可以重新启动IOS静音开关的功能；
        //在找到确切解决方法前，请勿删除这两步方法；
        that.voiceBtn(false);
        that.voiceBtn(false);
      },300);
    }else{
      log.info('用户: ' + this.data.username + '进入会议');
      console.log('用户: ' + this.data.username  + '进入会议');
    }

    // this.joinMeeting();
    // this.bindStart();
    eventBus.on("init", this.checkMineStatus); //初始化的判断自己的在线状态
    eventBus.on("user_joined", this.userJoin); //成员加入成功
    eventBus.on("chat_init", this.chatInit); //初始化消息列表
    eventBus.on("receive_message", this.receiveMessage); //收到新的聊天消息
    eventBus.on("mute_member", this.setMicroStatusSuccess); //操作麦克风成功
    eventBus.on("dismiss_room", this.dismissRoom); //主持人退出，解散谈话
    eventBus.on("quit_room", this.quitRoom); //参会人退出，重新赋值人员列表
    eventBus.on("recorder_change", this.recorderChange); //转移主持人
    eventBus.on("record_status", this.setVideoStatus); //录像状态监听事件
    eventBus.on("meeting_info_changed", (e) => this.updateMeetingData(e.detail.meetingCache)); //用户修改了姓名
    eventBus.on("member_user_changed", (e) => this.updateMeetingData(e.detail)); //接入法庭中的席位
    eventBus.on("screen_sharing_V3.0", (e) => this.shareScreen(e)); //共享屏幕
    eventBus.on("user_group_info", this.blackHouse); //被禁听
    eventBus.on("camera_turn", this.setCameraTurn); //翻转摄像头
    eventBus.on("note_sign", this.recordSignCheck); // 笔录签名
    eventBus.on("file_update", this.allowFileUpdate); // 上传文件功能关闭开启
    eventBus.on("main_screen_change", this.updateMainScreen); //用户修改了主画面
  },
  onReady() {
    // 切换摄像头，放在页面就绪里面（否则无效）
    this.ctx = wx.createLivePusherContext('pusher')
  },
  onUnload: function (options) {
    // 页面销毁时关闭连接
    MeetingService.logout();
    app.globalData.noFirstMeeting = false
  },
  /**
   * 主屏幕变化
   * **/
  updateMainScreen (e) {
    console.log("updateMainScreen",e);
    this.setData({
      meetingInfo:{
        ...this.data.meetingInfo,
        homeScreen:e.detail
      }
    });
    console.log('updateMainScreen',this.data.meetingInfo);
    this.setHomeScreen()
  },
  shareScreen(e){
    this.setData({
      hostInfo:null,
    });

    if (e && e.detail) {
      let { screenSharing,homeScreen } = e.detail;
      this.setData({
        meetingInfo:{
          ...this.data.meetingInfo,
          homeScreen
        },
      });
      console.log('shareScreen',this.data.meetingInfo)
      if (screenSharing) {
        screenSharing.pushScreen = screenSharing.sourceUserId === this.data.userId;
        this.setData({
          attendList:[
            ...this.data.attendList,
            screenSharing
          ]
        })
      } else {
        let leaveUserIndex = [];
        let attendList = this.data.attendList;
        this.data.attendList.forEach((attend, index) => {
          if (attend.sourceUserId) leaveUserIndex.push(index);
        });

        //删除退出用户数据
        if (leaveUserIndex.length) {
          for (let i = leaveUserIndex.length - 1; i >= 0; i--) {
            attendList.splice(leaveUserIndex[i], 1);
          }
        }
        this.setData({
          attendList
        })
      }
    }
    this.setHomeScreen()
  },
  /**
   * 加入会议
   * **/
  joinMeeting(initWs=true) {
    // 进入前给个等待loading显示
    wx.showLoading({
      title: '正在加载...',
      mask: true
    });
    let that = this;
    // 请求加入会议的接口
    joinMeetingFun({
      userName: that.data.username,
      meetingId: that.data.meetingId,
      userId: that.data.userId
    }).then(res => {
      if (res.data.success) {
        if (res.data.data) {
          this.updateMeetingData(res.data.data);
          if(initWs) this.initService();
          log.info('用户: ' + this.data.mineInfo.alias + `初始化websocket-${initWs},加入会议`);
        } else {
          log.error('用户: ' + this.data.mineInfo.alias + `加入会议异常${res.data}`);
          //获取谈话信息出错，提示用户退出
          this.onErrorTips("获取谈话信息出错，请退出重进！");
        }
        wx.hideLoading();
      } else {
        log.error("调用会议接口失败");
        // 接口失败就退出去
        wx.showToast({
          title: '连接失败',
          icon: 'error',
          duration: 1600,
          mask: false,
        }).then(() => {
          setTimeout(() => {
            that.goBack();
          }, 1500)
        })
      }
    })
  },
  /**
   *初始化websocket;
   * **/
  initService() {
    let {meetingInfo, userId} = this.data;
    let ws_str = `${app.globalData.websocketUrl}?orderId=${meetingInfo.orderId}&userId=${userId}`;
    MeetingService.init(ws_str, () => {
      this.onErrorTips("谈话连接错误。");
    });
  },
  /**
   * websocket初始化时,检查当前用户在线状态，如果不在线则退出到登录页面;
   * **/
  checkMineStatus(e){
    let {code,data}=e.content;
    if(code===1006){
      this.onErrorTips('会议已结束');
      return false;
    }
    // 用户websocket掉线后重连，被退出会议时，重新调用加入会议接口；
    const mineInfo=data.userList.find(item=>item.userId===this.data.userId);
    if(!mineInfo.online){
      this.joinMeeting(false);
    }
  },
  /**
   * 用户加入谈话成功回调
   * **/
  userJoin:tool2.throttle(function(e){
    let {userList,...otherParams} = e && e.detail;
    let newUsers=userList.filter(item=>item.online&&!this.data.attendList.some(ele=>ele.userId===item.userId));

    if (newUsers.length) {
      let names = [];
      newUsers.forEach((newUser) => {
        names.push(newUser.userName);
      });
      Notify({
        type: 'success',
        message: `用户${names.join(",")}加入了会议!`,
        safeAreaInsetTop: true,
        duration: 1000
      });
    }

    this.setData({
      attendList:[
        ...this.data.attendList,
        ...newUsers
      ],
      meetingInfo:{
        ...otherParams,
        orderId:otherParams.id
      }
    });
    console.log('userJoin',this.data.meetingInfo)
    this.setHomeScreen();
    // this.updateMeetingData(meetingCache)
  }),
  /**
   * 设置发言/静音成功回调
   * **/
  setMicroStatusSuccess(e) {
    log.info(`用户:${this.data.mineInfo.alias}静音成功回调：` + e);
    if (e && e.detail) {
      let {audio} = e.detail;
      let tempInfo = JSON.parse(JSON.stringify(this.data.mineInfo));
      tempInfo.micStatus = audio;
      this.setData({
        mineInfo: tempInfo
      });
    }
  },
  /**
   * 与客户端录像状态保待统一
   **/
  setVideoStatus(e) {
    if (e) {
      let tempInfo = JSON.parse(JSON.stringify(this.data.meetingInfo));
      tempInfo.isVideoTap = e.detail;
      this.setData({
        meetingInfo: tempInfo
      })
      console.log('setVideoStatus',this.data.meetingInfo)
    }
  },
  /**
   * 转移记录人
   **/
  recorderChange(e) {
    if (e && e.detail) {
      let {messages} = e.detail;
      this.data.meetingInfo.record = messages.recorder;
      Notify({
        type: 'success',
        message: "记录员已切换",
        safeAreaInsetTop: true
      });
      console.log('recorderChange',this.data.meetingInfo)
    }
  },
  /**
   * 主持人离开谈话，解散谈话，只有参会人会接到会议解散的广播消息。
   * **/
  dismissRoom(e) {
    this.onErrorTips("主持人已经解散会议");
  },
  /**
   * 监听参会人离开谈话
   * **/
  quitRoom(e) {
    if (e && e.detail) {
      let {leaveId, userName, quitMessage} = e.detail;
      let attendList = this.data.attendList;
      let tipContent = quitMessage ? quitMessage : `用户${userName}退出了会议!`;
      // 当前用户被踢出会议
      if (leaveId === this.data.userId) {
        this.goBack();
      } else {
        //离开谈话用户的ID
        //记录与退出人ID相同的参会人的数组下标，因为分享屏幕的用户会有两条数据，所有使用数组记录
        let leaveUserIndex = [];
        Notify({
          type: 'success',
          message: tipContent,
          safeAreaInsetTop: true
        });
        this.data.attendList.forEach((attend, index) => {
          if (attend.userId === leaveId) leaveUserIndex.push(index);
        });
        //删除退出用户数据
        if (leaveUserIndex.length) {
          for (let i = leaveUserIndex.length - 1; i >= 0; i--) {
            attendList.splice(leaveUserIndex[i], 1);
          }
        }
        this.setData({
          attendList
        })
      }
    }
  },
  /**
   * 被禁听
   * **/
  blackHouse(e) {
    if (e) {
      const {content} = e;
      const {userId, mineInfo,attendList} = this.data;//有人被禁听后，人员会被分组，数组下标为1的是被禁听的人；
      console.log(content[1] && content[1].indexOf(userId) >= 0);
      attendList.map(item=>{
        item.groupId =Boolean(!!(content[1] && content[1].indexOf(item.userId) >= 0));
      });
      mineInfo.groupId=!!(content[1] && content[1].indexOf(userId) >= 0);
      this.setData({
        mineInfo,
        attendList
      });
      console.log(this.data.mineInfo);
      console.log(this.data.attendList);
    }
  },
  /**
   * 翻转摄像头
   * **/
  setCameraTurn(e) {
    if (e) {
      const {content} = e;
      this.setData({
        mineInfo: {
          ...this.data.mineInfo,
          cameraType: content//根据客户端传过来的值设置当前用户的摄像头类型
        }
      });
    }
  },
  /**
   *笔录签名
   * */
  recordSignCheck(e) {
    Notify({
      type: 'success',
      message: "主持人发起笔录签名",
      safeAreaInsetTop: true
    });
    // 定义笔录图片列表的数组
    const recordImageList = [];
    // 处理下数据
    for (let i in e.content) {
      recordImageList.push(`${baseURL}${e.content[i]}?v=${new Date().getTime()}`)
    }
    let params = {
      recordImageList: recordImageList,
      meetingId: this.data.meetingInfo.meetingId,
      userId: this.data.userId,
      userName: this.data.mineInfo.alias
    };
    setTimeout(() => {
      this.setData({
        noteCheckParams: params,
        signNameDialog: true
      })
      console.log('11111111111111111',this.data.signNameDialog);
    }, 1000)
  },
  /**
   *上传文件
   * */
  allowFileUpdate(e) {
    if (e) {
      this.setData({
        meetingInfo: {
          ...this.data.meetingInfo,
          upLoadFile: e.detail
        }
      });
    }
    console.log("allowFileUpdate",this.data.meetingInfo)
  },
  /**
   * 参会人发生变化时，重新整理参会人、会议、席位的数据
   * **/
  updateMeetingData(data) {
    let mineInfo = [], courtSeatList = [], attendList = [];//, hostInfo = {};
    this.setData({
      closeVideoUserId: "",
      mineInfo: {},
      attendList: [],
      courtSeatList: []
    });

    let {userList, id, seatList, recordId, screenSharing, ...otherParams} = data || {};
    //主持人画面
    // hostInfo = userList.find((item) => {
    //   return item.userId === this.data.userId;
    // });

    //当前用户信息
    mineInfo = userList.find((item) => {
      return item.userId === this.data.userId;
    });
    //参会人列表
    attendList = [...userList, ...seatList].filter((item) => {
      return (item.online || item.enable) && item.userId !== this.data.closeVideoUserId;
    });
    //接入席位
    if (seatList && seatList.length) {
      //席位列表
      seatList.forEach((item) => {
        if (item.linkUserId && item.enable) this.data.closeVideoUserId = item.linkUserId; //记录要关闭的用户ID
        courtSeatList.push(item);
      });
    }

    //是不是有共享屏幕
    if (screenSharing) {
      screenSharing.sourceMain = screenSharing.userId;
      screenSharing.pushScreen = screenSharing.userId === this.data.userId;

      attendList.push(screenSharing);
    }
    this.setData({
      mineInfo,
      courtSeatList,
      attendList
    });
    //会议相关信息
    this.setData({
      meetingInfo: {
        orderId: id,
        isVideoTap: !!recordId, //是否正在录像
        ...otherParams,
      }
    });
    console.log("updateMeetingData",this.data.meetingInfo)
    this.setHomeScreen();
  },
  /**
   * 接口错误或谈话结束时的，提示用户退出的提示框
   * **/
  onErrorTips(content) {
    // 通知用户主持人解散会议
    Notify({
      type: 'warning',
      message: content,
      safeAreaInsetTop: true
    });
    setTimeout(() => {
      this.goBack();
    }, 3000);
  },
  /**
   * 离开页面
   * **/
  goBack() {
    // 调用关闭webSocket
    MeetingService.logout();
    // 调用清除缓存
    tool2.removeStorageInfo();
    // 延迟关闭加载和跳转登录
    setTimeout(() => {
      // 关闭loading
      wx.hideLoading();
      // 转到登录
      tool2.detectionSkipPage()
    }, 1000)
  },
  /**
   消息初始化
   */
  chatInit(e) {
    if (e) {
      this.setData({
        chatInfo: e
      })
    }
  },
  /**
   * 接收消息
   * **/
  receiveMessage(e) {
    let {messages} = e.detail;
    //如果是当前用户自己发出的，则不显示；
    if (messages.sendUserId !== this.data.userId) {
      let tempMessages = this.data.chatInfo.content;
      tempMessages.push({
        ...messages,
      });
      this.setData({
        chatInfo: {
          ...this.data.chatInfo,
          content: tempMessages
        },
        showNewMsgTip: !this.data.showChatDialog//如果聊天窗开启，就不显示提示消息浮窗；如果聊天窗未开启，显示提示消息浮窗
      });
    }
    if (this.data.chatInfo.content !== null) {
      this.goBottom();
    }
  },
  /**
   * 发送消息
   **/
  sendChatMsg(event) {
    if (!event.detail.value) {
      state.showTips = true;
      let timer = setInterval(() => {
        state.showTips = false;
        timer = null;
      }, 3000);
      return false;
    }

    let msgObj = {
      type: "chat",
      content: {
        orderId: this.data.meetingInfo.orderId,//会议ID
        sendUserId: this.data.userId,//发送人ID
        sendUserName: this.getMyName(),//查自己的名字
        receiveUserId: "",//消息接收人的ID
        receiveUserName: "",//消息接收人的名字
        content: event.detail.value,//消息内容
        groupId: this.data.chatInfo.groupId, //当前聊天群组ID
        type: 1, //消息类型，1为文本消息
      },
    };
    let tempMessages = this.data.chatInfo.content;
    tempMessages.push({
      ...msgObj.content,
    });
    this.setData({
      chatMsgContent: '',
      chatInfo: {
        ...this.data.chatInfo,
        content: tempMessages
      }
    });

    MeetingService.sendMsg(JSON.stringify(msgObj));

  },
  /**
   * 获取当前用户的名字
   * 发送聊天消息时使用
   * **/
  getMyName() {
    const name = this.data.attendList.find((item) => this.data.userId === item.userId || item.linkUserId === this.data.userId);
    return name.alias;
  },
  /**
   主动退出会议
   */
  closeMeetingBtn() {
    let that = this;
    wx.showModal({
      title: '退出谈话',
      content: '是否退出本次谈话',
      success(res) {
        if (res.confirm) {
          wx.showLoading({
            title: '正在退出...',
            mask: true
          }).then(() => {
            // 调用退出会议接口-返回后在处理，避免多次发送socket
            outMeeting({
              orderId: that.data.meetingInfo.orderId,
              userId: that.data.userId
            });
            that.goBack();
          })
        }
      }
    })
  },
  /**
   * 切换声音操作
   * **/
  voiceBtn(showTip=true) {
    log.info('用户:' + this.data.mineInfo.alias + '切换听筒/扬声器' + this.data.soundMode);
    console.log('用户:' + this.data.mineInfo.alias + '切换听筒/扬声器' + this.data.soundMode);
    // audioVolumeType: 'media', // 推流音量类型media-媒体音量,voicecall-通话音量
    // 拉流speaker扬声器ear听筒
    if (this.data.soundMode === 'speaker') {
      if(showTip)
        Notify({
          type: 'warning',
          message: '已切换,当前使用的是听筒',
          safeAreaInsetTop: true
        });
      this.setData({
        soundMode: 'ear',
        voiceShow: false
      })
    } else {
      if(showTip)
        Notify({
          type: 'warning',
          message: '已切换,当前使用的是扬声器',
          safeAreaInsetTop: true
        });
      this.setData({
        soundMode: 'speaker',
        voiceShow: true
      })
    }
  },
  /**
   * 切换摄像头
   * **/
  cameraBtn() {
    // 切换摄像头
    this.ctx.switchCamera()
  },
  showChooseFileMenu(){
    wx.navigateTo({
      url: `/pages/uploadFile/uploadFile?orderId=${this.data.meetingInfo.orderId}&userId=${this.data.userId}&userName=${this.data.mineInfo.userName}`
      // url: '/pages/uploadFile/uploadFile'
    })
    // this.setData({
    //   showToast:true
    // })
  },
  hideChooseFileMenu(){
    // this.setData({
    //   showToast:false
    // })
  },
  toUploadFileView(e){
    const fileType=e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/uploadFile/uploadFile?type=${fileType}&orderId=${this.data.meetingInfo.orderId}&userId=${this.data.userId}&userName=${this.data.mineInfo.userName}`
      // url: '/pages/uploadFile/uploadFile'
    })
    // wx.navigateTo({
    //   url: '/pages/view/view?meetingId='+this.data.meetingInfo.meetingId+'&userId='+this.data.userId
    // })
  },
  /**
   * 上传材料
   * **/
  uploadImg() {
    let that = this;
    wx.chooseImage({
      count: 9,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success(res) {
        log.info('用户: ' + that.data.mineInfo.userName + '选择上传材料成功' + JSON.stringify(res.tempFiles));
        for (let i = 0; i < res.tempFiles.length; i++) {
          const suffix = res.tempFiles[i].path.substring(res.tempFiles[i].path.lastIndexOf(".") + 1);
          const base64 = wx.getFileSystemManager().readFileSync(res.tempFiles[i].path, "base64");

          let params = {
            fileBaseStr: base64, //base64
            fileSuffix: suffix, //文件后缀
            name: new Date().getTime(), //文件名称
            orderId: that.data.meetingInfo.orderId,
            userId: that.data.userId,
            userName: that.data.mineInfo.userName
          };
          uploadingImg(params).then(res => {
            log.info('用户: ' + that.data.mineInfo.alias + '上传材料成功' + JSON.stringify(res.data));
            // that.joinMeeting();
          }).catch(err => {
            log.error('用户: ' + that.data.mineInfo.alias + '上传材料失败' + JSON.stringify(err));
          })
        }
      }
    })
  },
  //设置主屏幕显示的用户
  setHomeScreen() {
    if (this.data.attendList.length&&this.data.meetingInfo.started) {
      const recorder = this.data.attendList.find((item) => {
        return item.userId === this.data.meetingInfo.homeScreen;
      });
      if (recorder) {
          this.setData({
            hostInfo: recorder,
          })
        }
    }
  },
  /**
   * 点击用户视频时，全屏显示
   * **/
  setFullScreen(e) {
    let currFullScreenId = this.data.homeScreenId;
    this.setData({
      homeScreenId: e.currentTarget.dataset.resourceid === currFullScreenId ? -1 : e.currentTarget.dataset.resourceid
    })
  },
  /**
   * 拉流组件错误码
   * **/
  playerError(e) {
    log.info(`用户:${this.data.mineInfo.alias || ''} | 获取[${e.currentTarget.dataset.userinfo.alias || ''}] | 错误码 | ${e.detail.errMsg}`);
    console.log(`用户:${this.data.mineInfo.alias || ''} | ${e.currentTarget.dataset.userinfo.alias || ''} | 错误码 | ${e.detail.errMsg}`)
  },
  /**
   * 拉流组件网络变化
   * **/
  playerNetStatus(e) {
    let tips = '';
    let {audioBitrate, videoBitrate,netQualityLevel} = e.detail.info;
    switch (netQualityLevel) {
      case 0:
        tips = '未定义';
        break;
      case 1:
        tips = '最好';
        break;
      case 2:
        tips = '好';
        break;
      case 3:
        tips = '一般';
        break;
      case 4:
        tips = '差';
        break;
      case 5:
        tips = '很差';
        break;
      case 6:
        tips = '不可用';
        break;
    }
    log.info(`用户:${this.data.mineInfo.alias || ''} | 获取[${e.currentTarget.dataset.userinfo.alias || ''}] | 视频 | ${videoBitrate}`);
    log.info(`用户:${this.data.mineInfo.alias || ''} | 获取[${e.currentTarget.dataset.userinfo.alias}] | 音频 | ${audioBitrate}`);
    // log.info(`${e.currentTarget.dataset.userinfo.alias} | 网格状态 | ${e.detail.info.netQualityLevel} | ${tips}`);
    // console.log(`${e.currentTarget.dataset.userinfo.alias} | 网格状态 | ${e.detail.info.netQualityLevel} | ${tips}`)
    console.log(`用户:${this.data.mineInfo.alias || ''} | 获取[${e.currentTarget.dataset.userinfo.alias || ''}] | 视频 | ${videoBitrate}`);
    console.log(`用户:${this.data.mineInfo.alias || ''} | 获取[${e.currentTarget.dataset.userinfo.alias || ''}] | 音频 | ${audioBitrate}`);
  },
  /**
   * 拉流组件状态变化
   * **/
  playerStateChange(e) {
    const unEnableCode=[2005,2007,2008,2009,2105,2106,2107,2108];
    if(unEnableCode.indexOf(e.detail.code)<0){
      log.info(`用户:${this.data.mineInfo.alias || ''} | 获取 [${e.currentTarget.dataset.userinfo.alias}] 的状态变化 | ${e.detail.code} | ${e.detail.message || ''}`);
      console.log(`用户:${this.data.mineInfo.alias || ''} | 获取 [${e.currentTarget.dataset.userinfo.alias}] 的状态变化 | ${e.detail.code} | ${e.detail.message || ''}`);
    }
    //拉流：网络断连，且经多次重连无效，请自行重启拉流
    if (e.detail.code === '-2301') {
      // this.reconnectionFun(e.currentTarget.dataset.userinfo)
    }
  },
  /**
   * 推流组件错误码
   * **/
  pusherError(e) {
    // this.bindStart();
    log.info(`推送视频流 | 错误码 | ${e.detail.errMsg || ''}`);
    console.log(`推送视频流 | 错误码 | ${e.detail.errMsg || ''}`)
  },
  /**
   * 推流组件网络变化
   * **/
  pusherNetStatus(e) {
    let tips = '';
    let {audioBitrate, videoBitrate,netQualityLevel} = e.detail.info;
    switch (netQualityLevel) {
      case 0:
        tips = '未定义';
        break;
      case 1:
        tips = '最好';
        break;
      case 2:
        tips = '好';
        break;
      case 3:
        tips = '一般';
        break;
      case 4:
        tips = '差';
        break;
      case 5:
        tips = '很差';
        break;
      case 6:
        tips = '不可用';
        break;
    }
    // log.info(`${this.data.mineInfo.alias} | 网格状态 | ${netQualityLevel} | ${tips}`);
    log.info(`用户:${this.data.mineInfo.alias || ''} | 音量 | ${audioBitrate}`);
    log.info(`用户:${this.data.mineInfo.alias || ''} | 视频 | ${videoBitrate}`);
    console.log(`用户:${this.data.mineInfo.alias || ''} | 视频 | ${videoBitrate}`);
    console.log(`用户:${this.data.mineInfo.alias || ''} | 音量 | ${audioBitrate}`);
  },
  /**
   * 推流组件状态变化
   * **/
  pusherStateChange(e) {
    const {code,message}=e.detail;
    const unEnableCode=[1005,1006,1007,1008,1018,1019,1020,1021,1022,1031,1032,1033,1034,1103,1104,10003];
    if(unEnableCode.indexOf(e.detail.code)<0) {
      log.info(`${this.data.mineInfo.alias || ''} | 推送状态变化 | ${code} | ${message}`);
      console.log(`${this.data.mineInfo.alias || ''} | 推送状态变化 | ${code} | ${message}`);
    }
    // -1307推流：网络断连，且经多次重连抢救无效，更多重试请自行重启推流
    // 1008推流：编码器启动
    // 1303推流：视频编码失败
    if (code === '-1307'  || code==='-1303'  || code==='-1304') {
      this.reconnectionFun(this.data.mineInfo);
      this.bindStart();
    }
    //系统电话打断或者微信音视频电话打断
    if(code==='5001'){
      console.log("5001",this.data.soundMode);
      // this.bindStop();
    }
  },
  /**
   * 重新拉流
   */
  reconnectionFun(userInfo) {
    log.info(`${userInfo.alias} | 网络断连，且经多次重连无效，自行重启拉流`);
    if (this.data.reconnection < 3) {
      // 调用加入会议
      this.data.reconnection++;
      this.joinMeeting(false)
    } else {
      // 调用解散会议（关闭socket，清除缓存，回到首页）
      this.goBack()
    }
  },
  /**
   * 拉取笔录签名
   * 加了防抖
   */
  getNote: tool2.debounce(function () {
    let param = {
      orderId: this.data.meetingInfo.orderId,
      userId: this.data.userId,
    };
    Notify({type: 'success', message: '正在拉起签名...', safeAreaInsetTop: true, duration: 3000});
    // this.setData({isGetNote: false});
    userGetNote(param).then(res => {
      if (res.data.success) {
        let params = {
          content: res.data.data,
        };
        this.recordSignCheck(params)
      } else {
        Notify({type: 'success', message: res.data.message, safeAreaInsetTop: true});
        this.setData({isGetNote: true})
      }
    }).catch(err => {
      this.setData({isGetNote: true})
    })
  }),
  /**
   * 切换麦克风状态
   */
  toggleMicStatus() {
    let parms = {
      enable: !this.data.mineInfo.micStatus,
      meetingId: this.data.meetingId,
      userId: this.data.userId
    };
    log.info(`用户:${this.data.mineInfo.alias}切换静音状态 | `+JSON.stringify(parms));
    console.log(`用户:${this.data.mineInfo.alias}切换静音状态`,JSON.stringify(parms));
    setMicStatus(parms).then(res => {
      if (res.data.success) {
        this.setData({
          mineInfo: {
            ...this.data.mineInfo,
            micStatus: !this.data.mineInfo.micStatus
          }
        })
      } else {
        Notify({type: 'warning', message: res.data.message, safeAreaInsetTop: true})
      }
    })
  },
  /**
   * 聊天内容始终保持在底部
   */
  goBottom() {
    let that = this;
    setTimeout(() => {
      this.setData({
        scrollId: `goBottom${that.data.chatInfo.content.length - 1}`
      })
    }, 100)
  },
  /**
   * 关闭聊天弹窗和新消息提示
   */
  closeAllChat() {
    this.setData({
      showNewMsgTip: false,
      showChatDialog: false
    })
  },
  /**
   * 点击新消息提示浮窗，关闭浮窗，打开聊天窗口
   */
  openChatDialog() {
    this.setData({
      showChatDialog: true,
      showNewMsgTip: false,
      chatInfo:{
        ...this.data.chatInfo,
        newMessageNumber:0
      }
    });
    this.goBottom()
  },
  /**
   * 点击新消息提示浮窗，关闭浮窗，打开聊天窗口
   */
  closeNewMsgTip() {
    this.setData({
      showNewMsgTip: false
    });
    this.goBottom()
  },
  closeSignNameDialog() {
    this.setData({
      signNameDialog: false
    })
  },
  /**
   * 停止推流
   */
  bindStop() {
    console.log("bindStop",this.ctx);
    this.ctx.pause({
      success: res => {
        console.log('暂停推流成功',res);
        log.info(`${this.data.mineInfo.alias} | 暂停推流成功 | ${res}`);
      },
      fail: res => {
        console.log('暂停推流失败',res);
        log.info(`${this.data.mineInfo.alias} | 暂停推流失败 | ${res}`);
      }
    })
  },
  /**
   * 开始推流
   */
  bindStart() {
    console.log(this.ctx);
    this.ctx.start({
      success: res => {
        console.log('resume pusher success');
        log.info(`${this.data.mineInfo.alias} | 重新推流成功 | ${res}`);
      },
      fail: res => {
        console.log('resume pusher fail');
        log.info(`${this.data.mineInfo.alias} | 重新推流失败 | ${res}`);
      }
    })
  },
  chatInputOnFocus(e){
    console.log("chatInputOnFocus",e.detail.height);
    // wx.onKeyboardHeightChange(res => {
    //   console.log("chatInputOnFocus",res.height);
      this.setData({
        chatInputBottom:e.detail.height+'px'
      })
    // })
  },
  chatInputOnBlur(e){
    console.log("chatInputOnBlur",e.detail.height);
    // wx.onKeyboardHeightChange(res => {
    //   console.log("chatInputOnBlur",res.height);
      this.setData({
        chatInputBottom:e.detail.height+'px'
      })
    // })
  }
});