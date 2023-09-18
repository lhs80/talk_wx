import {
	checkConfirm,
	uploadBase64
} from '../../utils/api/api.js'
const log = require('../../log.js');
const QR = require('../../utils/weapp-qrcode.js');
const app = getApp();
Component({
	data: {
		QRCodeUrl:'',//签名二维码图片地址
		showRecordDialog:false,//笔录查看弹窗
		showSignPanel:false,//签字面板
		//=================================
		signNameBtn: false, // 签名提交按钮
		isStart: false, // 判断是否开始绘画
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
		recordParams: {
			type:Object,
			value:{}
		},
		show:{
			type:Boolean,
			value:false,
			observer:function(newVal){
				console.log("newVal",newVal);
				this.setData({
					showRecordDialog:newVal
				})
			}
		}
	},
	ready () {
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
			const query = wx.createSelectorQuery().in(this);
			const that = this;
			//选择id
			query.select('.signature').boundingClientRect();
			query.exec(function (res) {
				//获取canvas的宽高
				let canvasWidth = res[0].width;
				let canvasHeight = res[0].height;
				//清除画板
				that.mycanvas.clearRect(0, 0, canvasWidth, canvasHeight);
				//将画板渲染到页面
				that.mycanvas.draw(true);
				// 清除画板后将绘画状态改掉
				that.setData({
					isStart: false
				})
			})
		},
		// 确认笔录
		noteCheckSubmit () {
			let that = this; //解决一下this
			wx.showModal({
				title: '笔录确认',
				content: '您是否确认笔录?',
				success (res) {
					if (res.confirm) {
						checkConfirm({
							meetingId: that.properties.recordParams.meetingId,
							userId: that.properties.recordParams.userId
						}).then(res => {
							console.log("confirm record",res);
							log.info('用户' + that.properties.recordParams.userName + '确认笔录:' + JSON.stringify(res));
							wx.showToast({
								title: '确认成功',
								icon: 'success',
								duration: 2000
							});
							that.setData({
								noteCheck: false
							});
							that.noteCheckSignName()
						})
					} else if (res.cancel) {
						that.noteCheckSignName();
						log.warn('用户' + that.properties.recordParams.userName + '取消确认笔录');
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
		noteCheckClose () {
			// this.setData({
			// 	noteCheck: false
			// });
			this.noteCheckSignName()
		},
		/*
		*确认签名按钮
		*/
		signConfirm () {
			log.info('用户: ' + this.data.live_push_name + '确认签名');
			console.log('用户: ' + this.data.live_push_name + '确认签名' + app.globalData.platform);
			let {userId,meetingId}=this.properties.recordParams;
			if ( app.globalData.platform === 'mac') {
				let imgData = QR.drawImg(app.globalData.signUrl + `/index.html#/?meetingId=${meetingId}&userId=${userId}`, {
					typeNumber: 4,
					errorCorrectLevel: 'M',
					size: 200
				});
				this.setData({
					QRCodeUrl: imgData,
					showRecordDialog:false
				});
			} else {
				this.setData({
					showRecordDialog: false,
					showSignPanel: false
        })
        let {userId,meetingId}=this.properties.recordParams;
       console.log(userId,meetingId);
        wx.navigateTo({
          url: '/pages/view/view?meetingId='+meetingId+'&userId='+userId
        })
			}
		},
		// 提交签名
		submitSignature () {
			log.info('用户: ' + this.properties.recordParams.userName + '点击提交签名');
			console.log("submitSignature",this.data.isStart);
			// 新需求THX-809（可以用canvas的path判断长度，但是觉得不保险，所以用绘画状态判断）
			if (!this.data.isStart) {
				wx.showToast({
					title: '请先签名再提交！',
					icon: 'error',
					duration: 2000
				});
				return false;
			}
			// 禁用按钮
			this.setData({
				signNameBtn: true
			});
			let that = this;
			wx.canvasToTempFilePath({
				canvasId: 'canvas',
				fileType: 'png',
				success (res) {
					const base64 = wx.getFileSystemManager().readFileSync(res.tempFilePath, "base64");
					let param = {
						fileData: base64,
						meetingId: that.properties.recordParams.meetingId,
						userId: that.properties.recordParams.userId,
						whirl: false// 需要旋转签名
					};
					uploadBase64(param).then(res => {
						log.info('用户: ' + that.properties.recordParams.userName + '签名提交成功' + JSON.stringify(res));
						wx.showToast({
							title: '签名成功！',
							icon: 'success',
							duration: 2000
						}).then(res => {
							setTimeout(() => {
								that.closeRecordDialog();
								that.setData({
									signNameBtn: false
								});
							}, 1000)
						})
					}).catch(err => {
						log.error('用户: ' +  that.properties.recordParams.userName + '签名提交失败' + JSON.stringify(err));
						wx.showToast({
							title: '签名失败！',
							icon: 'error',
							duration: 2000
						}).then(res => {
							setTimeout(() => {
								// 开启按钮,需要重置状态，否则第二次打开时，按钮无法点击
								that.setData({
									signNameBtn: false
								});
								that.closeRecordDialog()
							}, 1000)
						})
					})
				}
			}, this)
		},
		/**
		 * 关闭笔录查看弹窗
		 * **/
		closeRecordDialog (params) {
			this.setData({
				// showRecordDialog:false,
				showSignPanel:false
			});
			this.triggerEvent('closeSignNameDialog')
		},
		/**
		 * 关闭签名二维码
		 * **/
		closeQRSignName() {
			this.setData({
				QRCodeUrl: ''
			})
			this.triggerEvent('closeSignNameDialog')
		},
		cancelSignature(){
			this.triggerEvent('closeSignNameDialog');
			this.setData({
				// showRecordDialog:false,
				showSignPanel:false
			});
		}
	}
});