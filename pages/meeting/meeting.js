// pages/meeting/meeting.js
import { joinMeetingFun, outMeeting, uploadingImg, userGetNote, setMicStatus } from '../../utils/api/api.js'
const webSocket = require('../../utils/socket')
import tool from '../../utils/tool'
import Notify from '@vant/weapp/notify/notify'
const log = require('../../log.js')
const app = getApp()
Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		meetingId: '',
		userId: '',
		username: '', //用户输入的姓名
		orderId: '', // orderId
		hostId: '', //主持人的id用于筛选
		emceeUrl: '', //主持人的流
		emceeName: '', //主持人名称
		emceeId: '', //主持人的id
		playIDNum: 0, //后端约定拉流url最后加上自增
		live_push: '', // 推流url
		live_push_name: '', // 推流名称
		live_pull: [], // 拉流地址
		cameraBtn: false, // 摄像头状态
		enableMic: true, //开启或关闭麦克风
		isupload: false, // 上传开关
		soundMode: 'speaker', // 扬声器||听筒
		voiceShow: true,//听筒扬声器图标的互换
		nowWinIndex: '', //当前用户的winIndex
		noteAndSignName: false, // 笔录和画板显示
		noteCheckParms: [], // 笔录校验的参数
		reconnection: 0, // 重连次数
		private_chat: false,
		litigationRole: '', // 身份ID
		chatGroupId: '', // 消息的分组ID
		chatMsgContent: '', // 发送的消息内容
		chatMsgHoverTip: {}, // 收到的消息小提示
		scrollId: '', // 聊天消息滚动位置
		chatMsgContentBody: [],// 消息内容
		chatNum: 0, // 消息条数
		userNameList: [], // 加入会议的时候存下来的用户姓名列表
		activeScreen: '', // 切换屏幕大小
		isMore: false, // 更多浮窗的显示
		isChatMsg: false, // 小的聊天浮窗的显示
		chatBody: false, // 聊天窗口的显示
		allUserList: [], // 所有用户列表
		isGetNote: true,
		chatInputHeight: 82,
		chatInputBg: '#fff',
		activeUser: '',
		meetingRecordStatus: false,
		mergeSeatList: [], // 合并后的席位列表
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: function (options) {
		let appType = wx.getStorageSync('userData');
		if (appType.appModel === 0) {
			wx.reLaunch({
				url: '/pages/meetingVertical/meetingVertical'
			})
			return
		}
		// 进入前给个等待loading显示
		wx.showLoading({
			title: '正在加载...',
			mask: true
		})
		// 获取登录缓存（没有用跳转传值）
		const UserStorage = wx.getStorageSync('user')
		// console.log(User)
		// 判断是否登录的缓，没有缓存就跳转登录
		if (UserStorage !== '') {
			// 将登录数据传递出去
			this.setData({
				meetingId: UserStorage.id,
				userId: UserStorage.userId,
				username: UserStorage.name
			});
			// 执行加入会议请求
			this.joinMeeting();
			// 延迟5秒关闭进入前等待loading的显示
			setTimeout(() => {
				wx.hideLoading()
			}, 5000)
		} else {
			wx.hideLoading()
			tool.detectionSkipPage() // 检测设备跳转到登录页
			return
		}
	},
	/**
	 * 生命周期函数--监听页面就绪
	 */
	onReady () {
		// 切换摄像头，放在页面就绪里面（否则无效）
		this.ctx = wx.createLivePusherContext('pusher')
	},
	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload: function (options) {
		// 页面销毁时关闭连接
		webSocket.closeSocket();
		app.globalData.noFirstMeeting = false
	},
	/**
	 * 加入会议
	 */
	joinMeeting () {
		// 定义that避免下面this不生效
		let that = this
		// 请求加入会议的接口
		joinMeetingFun({
			userName: that.data.username,
			meetingId: that.data.meetingId,
			userId: that.data.userId
		}).then(res => {
			try {
				let allUserList = res.data.data.userList
				this.setData({
					orderId: res.data.data.id, // 会议的orderId
					hostId: res.data.data.recorder, // 主持人
					allUserList: allUserList
				});
				const orderId = res.data.data.id // 会议的orderId
				const userId = that.data.userId // 会议的userId
				const recorder = res.data.data.recorder // 会议的userId
				// 缓存必要参数
				wx.setStorage({
					key: 'WsInfo',
					data: {
						orderId: orderId,
						userId: userId
					}
				})
				// 判断socket是否打开了，没有就打开
				if (app.globalData.socket === false) {
					webSocket.connectSocket(orderId, userId);
					// 设置socket接收消息回调
					webSocket.onSocketMessageCallback = this.onSocketMessageCallback;
				}
				// 筛选是本人的数据
				let self = allUserList.filter(item => item.userId === that.data.userId)
				// 筛选主持人的数据
				// let emcee = allUserList.filter(item => item.winIndex === 0 || item.userId === that.data.hostId)
				// for (let index in emcee) {
				// 	if (emcee[index].userId) {

				// 	}
				// }
				// if (emcee.length !== 0) {
				// 	if (emcee[0].userId === this.data.userId) {
				// 		this.setData({
				// 			activeUser: emcee[0].userId
				// 		})
				// 	} else {
				// 		this.pullEmceeStream(emcee) // 调用拉主持人
				// 	}
				// }
				this.pushSelfStream(self); // 调用推流自己
				// this.pullOtherListStream() // 调用拉用户列表
				this.mergeSeat(allUserList, res.data.data.seatList);
				this.disposeUserNameList(allUserList, 'join') // 处理入会的所有人名字
			} catch (error) {

			}
		}).catch(err => {
			log.error("调用会议接口失败: " + JSON.stringify(err))
			console.error("调用会议接口失败: " + JSON.stringify(err))
			// 接口失败就退出去
			wx.showToast({
				title: '连接失败',
				icon: 'error',
				duration: 1600,
				mask: false,
			}).then(() => {
				setTimeout(() => {
					this.dissolveMeeting()
				}, 1500)
			})
		})
	},
	// 推自己的流
	pushSelfStream (self) {
		let that = this
		// 处理数据
		self.forEach((self) => {
			let pushUrl = self.outRtmpUrl + '?caller_id=' + self.resourceId + '&playID=' + this.data.meetingId + '-' + self.winIndex + '-' + 'push'
			// 推流本人
			that.setData({
				live_push: pushUrl,
				live_push_name: self.alias,
				nowWinIndex: self.winIndex, //当前用户的winIndex
				litigationRole: self.litigationRole
			})
			log.info("我是推流本人Url: " + pushUrl + ",名字是：" + self.userName + ",winIndex是" + self.winIndex)
		})

	},
	// 拉主持人的流
	pullEmceeStream (emcee) {
		// 拉主持人的流
		let emceePullUrl = ''
		// 主持人的名字
		let emceePullName = ''
		// 主持人的id
		let emceePullId = ''
		// 处理下数据
		emcee.forEach((self) => {
			emceePullUrl += self.outRtmpUrl + '&playID=' + this.data.meetingId + '-' + this.data.nowWinIndex + '-' + this.data.playIDNum
			emceePullName += self.alias
			emceePullId += self.userId
			this.data.playIDNum += 1
		})
		// 传递出去拉主持人的流和名字
		this.setData({
			emceeUrl: emceePullUrl,
			emceeName: emceePullName,
			emceeId: emceePullId,
			activeUser: emceePullId
		})
		// 缓存主持人
		wx.setStorage({
			key: 'emceeList',
			data: {
				emceeUrl: emceePullUrl,
				emceeName: emceePullName,
				emceeId: emceePullId
			}
		})
		log.info("我是主持人拉流Url: " + emceePullUrl + ",名字是：" + emceePullName + ",winIndex是" + this.data.nowWinIndex)
	},
	// 拉其他用户的流
	pullOtherListStream () {
		// let otherUserList = this.data.allUserList
		let otherUserList = this.data.mergeSeatList
		// 筛选出不是自己、主持人和online为true在线的流
		let other = otherUserList.filter(item => item.winIndex !== 0 && item.userId !== this.data.hostId && item.userId !== this.data.userId && item.online !== false)
		// 拉流地址
		let pull = []
		// 处理下数据
		other.forEach((self) => {
			// 这里后端告知url拼接要区分
			if (self.outRtmpUrl.indexOf('?') !== -1) {
				pull.push(JSON.parse(`{"url":"${self.outRtmpUrl}&playID=${this.data.meetingId}-${this.data.nowWinIndex}-${this.data.playIDNum}","username":"${self.alias}","id":"${self.userId}"}`))
			} else {
				pull.push(JSON.parse(`{"url":"${self.outRtmpUrl}?playID=${this.data.meetingId}-${this.data.nowWinIndex}-${this.data.playIDNum}","username":"${self.alias}","id":"${self.userId}"}`))
			}
			this.data.playIDNum += 1
		})
		log.info("我是拉其他流列表: " + JSON.stringify(pull))
		// 缓存用户列表
		wx.setStorage({
			key: 'meetingUserList',
			data: pull
		})
		this.sliceList(pull)
	},
	// socket收到的信息回调
	onSocketMessageCallback (msg) {
		const scoketMsg = JSON.parse(msg)
		switch (scoketMsg.type) {
			case 'join':
				this.socketJoin(scoketMsg)
				break
			case 'leave':
				this.socketLeave(scoketMsg)
				break
			case 'dismiss':
				this.socketDismiss(scoketMsg)
				break
			case 'note_check':
				this.socketNoteCheck(scoketMsg)
				break
			case 'note_sign':
				this.socketNoteSignName(scoketMsg)
				break
			case 'camera_turn':
				this.socketCamera(scoketMsg)
				break
			case 'media_enable':
				this.socketMedia(scoketMsg)
				break
			case 'file_update':
				this.socketFile(scoketMsg)
				break
			case 'user_group_info':
				this.socketGroup(scoketMsg)
				break
			case 'heartbeat':
				break
			case 'chat_init':
				this.chatInit(scoketMsg)
				break
			case 'chat':
				this.chatMsg(scoketMsg)
				break
			case 'record_status':// 开启/关闭录像
				this.recordStatus(scoketMsg)
				break
			case 'meeting_info_changed': // 修改主画面/改名
				this.meetingInfoChange(scoketMsg)
				break
			case 'member_user_changed': // 席位
				this.mergeSeat(scoketMsg.content.meetingCache.userList, scoketMsg.content.meetingCache.seatList)
				break
			case 'screen_sharing_V3.0': // 屏幕共享
				// this.switchRTMP(scoketMsg)
				this.screen_sharing_V3_0(scoketMsg.content.meetingCache.screenSharing, scoketMsg.content.meetingCache.userList, scoketMsg.content.meetingCache.seatList)
				break
			case 'init':
				if (scoketMsg.content.code !== 0) {
					Notify({ type: 'success', message: '会议已经结束!', safeAreaInsetTop: true })
					// 调用关闭操作
					this.dissolveMeeting()
					return
				}
				this.socketInit(scoketMsg)
				// 不是首次入会
				// log.info('收到初始化调用加入会议：', app.globalData.noFirstMeeting)
				// if (app.globalData.noFirstMeeting) {
				// 	log.info('收到初始化调用加入会议：', app.globalData.noFirstMeeting)
				// 	this.joinMeeting()
				// }
				// app.globalData.noFirstMeeting = true
				break
		}
	},
	/*
	 * 以下为socket相关
	 */
	// 初始化
	socketInit (e) {
    log.info("websocket消息-初始化socket：" + JSON.stringify(e.type) + JSON.stringify(e.content))

		let that = this
		const initUserList = e.content.data.userList
		let noForbidHearArr = [] //不禁听列表
		let forbidHearArr = [] //禁听列表
		// 处理禁听和不禁听
		initUserList.forEach(item => {
			// 处理摄像头cameraTurn
			if (item.userId === that.data.userId) {
				that.setData({
					cameraBtn: item.cameraTurn,
					enableMic: item.micStatus
				})
			}
			// 处理静音分组
			if (item.groupId === 0) {
				noForbidHearArr.push(item.userId)
			} else {
				forbidHearArr.push(item.userId)
			}
		})
		// 存放禁听数据
		let forbidHearMap = {
			0: noForbidHearArr,
			1: forbidHearArr
		}
		// 处理禁听相关
		this.listenQuiet(forbidHearMap)
		// 处理用户上传禁用启用
		this.setData({
			isupload: e.content.data.upLoadFile,
			reconnection: 0,
			meetingRecordStatus: e.content.data.recordId !== undefined ? true : false // 是否录制中
		})
		if (e.content.data.screenSharing) {
			this.screen_sharing_V3_0(e.content.data.screenSharing, e.content.data.userList, e.content.data.seatList)
		}
	},
	// 加入会议
	socketJoin (e) {
    log.info("websocket消息-加入会议：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		if (!this.data.private_chat) return
		let that = this
		if (this.data.emceeUrl === '') {
			// 筛选主持人的流
			let emceePull = e.content.meetingCache.userList.filter(item => item.userId === e.content.recorder)
			this.pullEmceeStream(emceePull) // 调用拉主持人
		}
		this.disposeUserNameList(e.content.meetingCache.userList, 'socketJoin')
		this.joinMeetingUserList(e.content.meetingCache.userList)
		this.mergeSeat(e.content.meetingCache.userList, e.content.seatList)
	},
	// 摄像头
	socketCamera (e) {
		log.info("websocket消息-摄像头翻转：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		this.setData({
			cameraBtn: e.content
		})
	},
	// 静音
	socketMedia (e) {
		log.info("websocket消息-开启了静音：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		this.setData({
			enableMic: e.content.audio
		})
	},
	// 文件上传
	socketFile (e) {
		log.info("websocket消息-是否允许上传：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		this.setData({
			isupload: e.content
		})
	},
	// 分组
	socketGroup (e) {
		log.info("websocket消息-用户分组：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		this.listenQuiet(e.content)
	},
	// 笔录校验
	socketNoteCheck (e) {
		log.info("websocket消息-笔录校验：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		Notify({ type: 'success', message: '主持人发起了笔录校验!', safeAreaInsetTop: true })
		this.setData({
			noteAndSignName: false
		})
		// 定义笔录图片列表的数组
		const noteCheckList = []
		// 处理下数据
		for (let i in e.content) {
			noteCheckList.push(app.globalData.baseUrl + e.content[i])
		}
		// 延迟加载笔录给提示框留点时间-也可以不给延时
		let date = new Date().getTime()
		let parms = {
			noteCheckList: noteCheckList,
			noteCheckListRandom: date,
			noteCheck: true, //显示笔录
			noteCheckBtn: true, //确认笔录按钮
			noteCheckListRandom: date,
			noteSignBtn: false, //确认签名按钮隐藏
			meetingId: this.data.meetingId,
			userId: this.data.userId
		}
		setTimeout(() => {
			this.setData({
				noteCheckParms: parms,
				noteAndSignName: true
			})
		}, 2000)
	},
	// 笔录签名
	socketNoteSignName (e) {
		log.info("websocket消息-笔录签名：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		if (e.type !== 'Initiative_note_sign') {
			Notify({ type: 'success', message: '主持人发起了签名!', safeAreaInsetTop: true })
		}
		this.setData({
			noteAndSignName: false
		})
		// 定义笔录图片列表的数组
		const noteCheckList = []
		// 处理下数据
		for (let i in e.content) {
			noteCheckList.push(app.globalData.baseUrl + e.content[i])
		}
		// 延迟加载笔录给提示框留点时间-也可以不给延时
		let date = new Date().getTime()
		let parms = {
			noteCheckList: noteCheckList,
			noteCheckListRandom: date,
			noteCheck: true, //显示笔录
			noteCheckBtn: false, //确认笔录按钮隐藏
			noteCheckListRandom: date,
			noteSignBtn: true, //确认签名按钮
			meetingId: this.data.meetingId,
			userId: this.data.userId
		}
		setTimeout(() => {
			this.setData({
				noteCheckParms: parms,
				noteAndSignName: true,
				isGetNote: true
			})
		}, 2000)
	},
	// 离开
	socketLeave (e) {
		log.info("websocket消息-离开会议：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		// 当前会议列表数据
		const meetingList = this.data.allUserList
		// 循环删除退出的人
		for (let i = 0; i < meetingList.length; i++) {
			if (meetingList[i].userId === e.content.userId) {
				meetingList.splice(i, 1);
			}
		}
		this.setData({ mergeSeatList: meetingList })
		// 退出的人是自己就调用退会议
		if (e.content.userId === this.data.userId) {
			this.dissolveMeeting()
		}
		// 提示离开
		if (e.content.quitMessage === undefined || e.content.quitMessage === '') {
			Notify({ type: 'success', message: '用户：' + e.content.alias + ' 离开了会议', safeAreaInsetTop: true })
			log.info("用户：" + e.content.alias + "离开了会议")
		} else {
			Notify({ type: 'success', message: e.content.quitMessage, safeAreaInsetTop: true })
			log.info(e.content.quitMessage)
		}
		this.delLeaveName(e.content.alias)
		this.pullOtherListStream()
	},
	// 解散
	socketDismiss (e) {
		log.info("websocket消息-解散会议：" + JSON.stringify(e.type) + JSON.stringify(e.content))
		// 通知用户主持人解散会议
		Notify({ type: 'success', message: '主持人已经解散会议！', safeAreaInsetTop: true })
		// 调用关闭操作
		this.dissolveMeeting()
	},
	// 消息初始化
	chatInit (e) {
		e.content.forEach(item => {
			if (item.groupName === '全部') {
				this.setData({
					chatGroupId: item.groupId,
					chatMsgContentBody: item.chatContent.historyMessage.concat(item.chatContent.newMessages)
				})
			}
		})
	},
	// 收到消息
	chatMsg (e) {
		if (e.content.sendUserId === this.data.userId) return // 过滤掉我自己发的
		let oldMsg = this.data.chatMsgContentBody
		oldMsg.push(e.content)
		if (!this.data.chatBody) {
			this.setData({
				isChatMsg: true,
				chatNum: this.data.chatNum + 1
			})
		}
		this.setData({
			chatMsgContentBody: oldMsg,
			chatMsgHoverTip: {
				msg: e.content.content,
				name: e.content.sendUserName
			}
		})
		console.log('收到消息', e.content)
		this.goBottom()
	},
	// 开启关闭录像
	recordStatus (e) {
		this.setData({
			meetingRecordStatus: e.content
		})
	},
	// 修改主画面/名称
	meetingInfoChange (e) {
		let that = this
		let allUserList = e.content.userList
		// 筛选是本人的数据
		let self = allUserList.filter(item => item.userId === that.data.userId)
		// 筛选主持人的数据
		let emcee = allUserList.filter(item => item.winIndex === 0)
		if (emcee[0].userId === this.data.userId) {
			this.setData({
				activeUser: emcee[0].userId
			})
		} else {
			this.pullEmceeStream(emcee) // 调用拉主持人
		}
		this.pushSelfStream(self) // 调用推流自己
		// this.pullOtherListStream() // 调用拉用户列表
		this.mergeSeat(allUserList, e.content.seatList)
		this.disposeUserNameList(allUserList, 'join') // 处理入会的所有人名字
	},
	/*
	 * 以上为socket相关
	 */
	// 退出会议
	closeMeetingBtn () {
		let that = this
		wx.showModal({
			title: '退出谈话',
			content: '是否退出本次谈话',
			success (res) {
				if (res.confirm) {
					// 调用退出会议接口-返回后在处理，避免多次发送socket
					outMeeting({
						orderId: that.data.orderId,
						userId: that.data.userId
					}).then(res => {
						that.dissolveMeeting()
					}).catch(err => {
						that.dissolveMeeting()
					})
					// 产品要求不等接口返回，调用了就退出（异常见上面，斌哥口述问题）
					// outMeeting({
					// 	orderId: that.data.orderId,
					// 	userId: that.data.userId
					// })
					// that.dissolveMeeting()
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
	},
	// 切换声音操作
	voiceBtn () {
		// audioVolumeType: 'media', // 推流音量类型media-媒体音量,voicecall-通话音量
		// 拉流speaker扬声器ear听筒
		if (this.data.soundMode === 'speaker') {
			Notify({ type: 'warning', message: '已切换,当前使用的是听筒', safeAreaInsetTop: true })
			this.setData({
				soundMode: 'ear',
				voiceShow: false
			})
		} else {
			Notify({ type: 'warning', message: '已切换,当前使用的是扬声器', safeAreaInsetTop: true })
			this.setData({
				soundMode: 'speaker',
				voiceShow: true
			})
		}
	},
	// 切换摄像头
	cameraBtn () {
		// 切换摄像头
		this.ctx.switchCamera()
	},
	// 解散会议
	dissolveMeeting () {
		// 退出的loading
		wx.showLoading({
			title: '正在退出...',
			mask: true
		}).then(() => {
			// 调用关闭webSocket
			webSocket.closeSocket();
			// 调用清除缓存
			tool.removeStorageInfo()
			// 延迟关闭加载和跳转登录
			setTimeout(() => {
				// 关闭loading
				wx.hideLoading()
				// 转到登录
				tool.detectionSkipPage()
			}, 800)
		})
	},

	// 静听
	listenQuiet (newListContent) {
		console.log('静听:', newListContent)
		const emceeList = wx.getStorageSync('emceeList') // 主持人
		const userList = wx.getStorageSync('meetingUserList') // 用户列表
		// 获取对象的长度
		let ObjLength = Object.keys(newListContent)
		if (ObjLength.length === 1) {
			this.setData({
				private_chat: true,
			})
			this.joinMeeting()
			return
		}
		// 未静音
		let noAlreadyForbidList = newListContent[0].filter(item => item === this.data.userId)
		// 未静音里没有我自己，就去处理静音列表里
		if (noAlreadyForbidList.length === 0) {
			this.setData({
				private_chat: false,
				emceeUrl: '',
				emceeName: '',
				enableMic: false
			})
			// 被静音的人员列表
			let disposeList = newListContent[1].filter(item => item !== this.data.userId)
			// 存放被静音的人员列表 
			let alreadyForbidUserList = []
			// 拿传来的静音列表去循环比对当前会议列表，并传递出去
			disposeList.forEach(id => {
				userList.forEach(item => {
					if (id === item.id) {
						alreadyForbidUserList.push(item)
					}
				})
			})
			log.info("静音的列表：" + JSON.stringify(alreadyForbidUserList))
			this.sliceList(alreadyForbidUserList)
		} else {
			this.setData({
				private_chat: true,
				emceeUrl: emceeList.emceeUrl,
				emceeName: emceeList.emceeName,
				emceeId: emceeList.emceeId
			})
			// 未静音的人员列表
			let disposeList = newListContent[0].filter(item => item !== this.data.userId && item !== this.data.emceeId)
			// 存放被未音的人员列表
			let noAlreadyForbidUserList = []
			// 拿传来的静音列表去循环比对当前会议列表，并传递出去
			disposeList.forEach(id => {
				userList.forEach(item => {
					if (id === item.id) {
						noAlreadyForbidUserList.push(item)
					}
				})
			})
			log.info("未静音的列表：" + JSON.stringify(noAlreadyForbidUserList))
			this.sliceList(noAlreadyForbidUserList)
		}
	},
	// 上传材料
	uploadImg () {
		let that = this
		wx.chooseImage({
			count: 9,
			sizeType: ['original'],
			sourceType: ['album', 'camera'],
			success (res) {
				log.info('用户: ' + that.data.live_push_name + '选择上传材料成功' + JSON.stringify(res.tempFiles));
				for (let i = 0; i < res.tempFiles.length; i++) {
					const suffix = res.tempFiles[i].path.substring(res.tempFiles[i].path.lastIndexOf(".") + 1)
					const base64 = wx.getFileSystemManager().readFileSync(res.tempFiles[i].path, "base64");
					console.log(base64)
					let parms = {
						fileBaseStr: base64, //base64
						fileSuffix: suffix, //文件后缀
						name: new Date().getTime(), //文件名称
						orderId: that.data.orderId,
						userId: that.data.userId,
						userName: that.data.username
					}
					uploadingImg(parms).then(res => {
						log.info('用户: ' + that.data.live_push_name + '上传材料成功' + JSON.stringify(res.data));
					}).catch(err => {
						log.error('用户: ' + that.data.live_push_name + '上传材料失败' + JSON.stringify(err));
					})
				}
			}
		})
	},
	// 子组件传来的
	noteCheckSignName (e) {
		this.setData({
			noteAndSignName: e.detail
		})
	},
	// 推拉流的一些错误编号
	playother (e) {
		let that = this
		log.info('用户: ' + this.data.live_push_name + '拉流其他用户流状态' + JSON.stringify(e.detail.code));
		// 拉流其他用户流状态为-2301网络断连，且经多次重连抢救无效，更多重试请自行重启播放 || -2302	获取加速拉流地址失败
		if (e.detail.code === -2301) {
			if (that.data.reconnection < 3) {
				webSocket.connectSocket(that.data.orderId, that.data.userId);
				that.data.reconnection++
			}
		}
	},
	error2 (e) {
		log.error('用户: ' + this.data.live_push_name + '拉流其他用户流错误状态' + JSON.stringify(e.detail.errMsg));
		this.reconnectionFun()
	},
	statechange (e) {
		let that = this
		log.info('用户: ' + this.data.live_push_name + '推流' + JSON.stringify(e.detail.code));
		// -1307	网络断连，且经多次重连抢救无效，更多重试请自行重启推流
		if (e.detail.code === -1307) {
			that.reconnectionFun()
		}
	},
	play (e) {
		let that = this
		log.info('用户: ' + this.data.live_push_name + '拉主持人流' + JSON.stringify(e.detail.code));
		// 拉流主持人的流为-2301网络断连，且经多次重连抢救无效，更多重试请自行重启播放 || -2302	获取加速拉流地址失败
		if (e.detail.code === -2301) {
			that.reconnectionFun()
		}
	},
	error (e) {
		log.error('用户: ' + this.data.live_push_name + '拉主持人流错误' + JSON.stringify(e.detail.errMsg));
		this.reconnectionFun()
	},
	// 重试拉流
	reconnectionFun () {
		// webSocket.closeSocket(); // 断开socket链接
		let that = this
		if (that.data.reconnection < 3) {
			// 调用加入会议
			this.joinMeeting()
			that.data.reconnection++
		} else {
			// 调用解散会议（关闭socket，清除缓存，回到首页）
			this.dissolveMeeting()
		}
	},
	// 切换屏幕大小
	switchScreen (e) {
		let active = e.currentTarget.dataset.index
		switch (active) {
			case 'viceScreen':
				this.homeScreen(active)
				break
			case 'homeScreen':
				this.homeScreen(active)
				break
			default:
				if (this.data.activeScreen === active) {
					this.setData({ activeScreen: '' })
				} else {
					this.setData({ activeScreen: active })
				}
				break
		}
	},
	// 当前主屏幕
	homeScreen (e) {
		if (this.data.activeScreen === e) {
			// this.setData({ activeScreen: '' })
		} else {
			this.setData({ activeScreen: e })
		}
	},
	// 控制台更多
	more () {
		this.setData({
			isMore: !this.data.isMore
		})
	},
	/**
	 * 关闭小聊天提示
	 */
	getChatMsg () {
		this.setData({
			isChatMsg: !this.data.isChatMsg
		})
	},
	/**
	 * 打开或关闭聊天
	 * 每次点击调用居底方法
	 */
	chatBody () {
		this.setData({
			chatBody: !this.data.chatBody,
			chatNum: 0,
			isChatMsg: false
		})
		this.goBottom()
	},
	/**
	 * 用户静音
	 */
	enableOrOpenMic () {
		// this.setData({
		// 	enableMic: !this.data.enableMic
		// })
		let parms = {
			enable: !this.data.enableMic,
			meetingId: this.data.meetingId,
			userId: this.data.userId
		}
		setMicStatus(parms).then(res => {
			if (res.data.success) {
				this.setData({
					enableMic: !this.data.enableMic
				})
			} else {
				Notify({ type: 'warning', message: res.data.message, safeAreaInsetTop: true })
			}
		}).catch(err => {

		})
	},
	/**
	 * 拆分入会人员数据每4个为一组
	 * @param {*} list 拉流的列表
	 */
	sliceList (list) {
		const arr = list
		const len = arr.length
		let result = []
		const sliceNum = 4
		for (let i = 0; i < len / sliceNum; i++) {
			result.push(arr.slice(i * sliceNum, (i + 1) * sliceNum))
		}
		this.setData({
			live_pull: result
		})
		log.info('拆分入会人员数据每4个为一组', this.data.live_pull)
	},
	/**
	 * 拉取笔录签名
	 * 加了防抖
	 */
	getNote: tool.debounce(function () {
		let param = {
			orderId: this.data.orderId,
			userId: this.data.userId,
		}
		Notify({ type: 'success', message: '正在拉起签名...', safeAreaInsetTop: true, duration: 3000 })
		this.setData({ isGetNote: false })
		userGetNote(param).then(res => {
			if (res.data.code === 0 && res.data.success) {
				let parms = {
					content: res.data.data,
					type: "Initiative_note_sign"
				}
				this.socketNoteSignName(parms)
			} else {
				Notify({ type: 'success', message: res.data.message, safeAreaInsetTop: true })
				this.setData({ isGetNote: true })
			}
		}).catch(err => {
			this.setData({ isGetNote: true })
		})
	}),
	/**
	 * socket发送消息
	 * @param {*} event 内容
	 */
	sendChatMsg (event) {
		let that = this
		let oldMsg = this.data.chatMsgContentBody
		let msg = {
			msg: JSON.stringify({
				type: 'chat',
				content: {
					groupId: that.data.chatGroupId,
					orderId: that.data.orderId,
					sendUserId: that.data.userId,
					sendUserName: that.data.username,
					type: 1,
					sendRoleId: that.data.litigationRole,
					content: event.detail.value,
				}
			})
		}
		let sendMsg = JSON.parse(msg.msg)
		oldMsg.push(sendMsg.content)
		this.setData({
			chatMsgContent: '',
			chatMsgContentBody: oldMsg
		})
		this.goBottom()
		log.info('发送的消息：', oldMsg)
		webSocket.sendSocketMessage(msg)
	},
	/**
	 * 数组比对新入会的那个人的数据，避免页面渲染问题
	 * @param {*} arr1 入会接口返的用户列表
	 * @param {*} arr2 socket返回的用户列表
	 * 备注，后面有时间可以与下面的noticeJoinMeeting方法合并优化
	 */
	joinMeetingUserList (arr2) {
		let result = [];
		let allUserList = this.data.allUserList
		for (let i = 0; i < arr2.length; i++) {
			let obj = arr2[i];
			let num = obj.userId;
			let isExist = false;
			for (let j = 0; j < allUserList.length; j++) {
				let aj = allUserList[j];
				let n = aj.userId;
				if (n == num) {
					isExist = true;
					break;
				}
			}
			if (!isExist) {
				result.push(obj);
			}
		}
		// 二次处理
		for (const index in result) {
			allUserList.push(result[index])
		}
		this.setData({
			allUserList: allUserList
		})
		// this.pullOtherListStream() // 调用拉用户列表
	},
	/**
	 * 数组比对找出入会姓名
	 * @param {*} arr1 入会接口返的用户名称列表
	 * @param {*} arr2 socket返回的用户名称列表
	 */
	noticeJoinMeeting (arr1, arr2) {
		let arr3 = []
		for (let i = 0; i < arr2.length; i++) {
			let obj = arr2[i]
			let isExist = false;
			for (let k = 0; k < arr1.length; k++) {
				if (arr2[i] === arr1[k]) {
					isExist = true;
					break
				}
			}
			if (!isExist) {
				arr3.push(obj);
			}
		}
		this.setData({ userNameList: arr2 })
		Notify({ type: 'success', message: `用户：${arr3} 加入了会议`, safeAreaInsetTop: true })
		log.info('入会人员：', this.data.userNameList, arr2, arr3)
	},
	/**
	 * 处理入会和socket加入用户列表姓名
	 * @param {*} data 用户列表
	 * @param {*} type 自己加入或者socket通知
	 */
	disposeUserNameList (data, type) {
		let nameList = []
		for (const index in data) {
			if (data[index].online) {
				nameList.push(data[index].alias)
			}
		}
		// console.log(nameList)
		if (type === 'join') {
			this.setData({
				userNameList: nameList
			})
		} else {
			let oldNameList = this.data.userNameList
			this.noticeJoinMeeting(oldNameList, nameList) // 传参调用通知入会
		}
	},
	/**
	 * 退出删除对应的名称
	 * @param {*} name 退出的用户名称
	 */
	delLeaveName (name) {
		let list = this.data.userNameList
		for (const index in list) {
			if (list[index] === name) {
				list.splice(index, 1)
			}
		}
		this.setData({
			userNameList: list
		})
	},
	/**
	 * 始终保持聊天在底部
	 */
	goBottom () {
		let that = this
		setTimeout(() => {
			this.setData({
				scrollId: `goBottom${that.data.chatMsgContentBody.length - 1}`
			})
		}, 100)
	},
	// 聊天输入条动态修改位置
	chatInputPush (e) {
		console.log('', e)
		this.setData({
			chatInputHeight: e.detail.height === 0 ? 82 : e.detail.height * 2 + 5,
			chatInputBg: '#FFF'
		})
	},
	// 聊天输入条动态修改位置
	chatInputPull () {
		this.setData({
			chatInputHeight: 82,
			chatInputBg: '#FFF'
		})
	},
	// 主画面
	activeWinIdex () {
		let userList = this.data.mergeSeatList
		let that = this
		// 筛选主持人的数据
		let winIndex = userList.filter(item => item.winIndex === 0 && item.online !== false)
		let recorderId = userList.filter(item => item.userId === that.data.hostId && item.online !== false)
		let screenSharing = userList.filter(item => item.type === 'screenSharing')
		if (screenSharing.length !== 0) {
			this.setData({
				activeUser: screenSharing[0].userId
			})
			this.pullEmceeStream(screenSharing)
		} else if (winIndex.length !== 0) {
			this.setData({
				activeUser: winIndex[0].userId
			})
			this.pullEmceeStream(winIndex)
			return
		} else if (recorderId.length !== 0) {
			this.setData({
				activeUser: recorderId[0].userId || recorderId[0].id
			})
			this.pullEmceeStream(recorderId)
			return
		} else {
			this.setData({
				private_chat: false
			})
		}
	},
	// 合并处理席位
	mergeSeat (other, seatList) {
		// return
		// 处理下数据
		let newOther = seatList.map(item => ({
			userId: item.linkUserId === '' ? item.userId : item.linkUserId,
			outRtmpUrl: item.outRtmpUrl,
			alias: item.alias,
			online: item.enable,
			winIndex: item.winIndex,
		}))
		// 数组合并处理席位
		let userList = newOther.concat(other).filter(item => item.online !== false)
		let newArrList = []
		for (let item1 of userList) {
			let flag = true
			for (let item2 of newArrList) {
				if (item1.userId == item2.userId) {
					flag = false
				}
			}
			if (flag) {
				newArrList.push(item1)
			}
		}
		// return newArrList
		this.setData({
			mergeSeatList: newArrList
		})
		this.pullOtherListStream()
		this.activeWinIdex()
	},
	// 拉取屏幕共享流
	screen_sharing_V3_0 (screenSharing, userList, seatList) {
		// 禁言中屏幕共享不处理
		if (!this.data.private_chat) return
		if (!screenSharing) {//
			this.mergeSeat(userList, seatList)
			return
		}
		let list = this.data.mergeSeatList
		let screenSharingData = {
			outRtmpUrl: screenSharing.outRtmpUrl,
			userId: screenSharing.userId,
			online: true,
			winIndex: screenSharing.winIndex,
			alias: screenSharing.alias,
			type: 'screenSharing'
		}
		list.push(screenSharingData)
		this.setData({
			mergeSeatList: list
		})
		this.activeWinIdex() //设置主画面
	}
})