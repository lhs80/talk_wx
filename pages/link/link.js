// pages/link/link.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    url: 'https://talk.xsykj.com.cn:7443/relay/test2/index.html'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log("options:", options)
    // 判断options.inviteCode有没有，没有就说明不是短信拉起，有就是短信拉起就执行登录
    if (options.inviteCode !== undefined) {
      this.setData({
        url: this.url + "?inviteCode=" + options.inviteCode
      })
      log.info('短信唤起')
    } else if (options.meetingId !== undefined && options.userName !== undefined) {
      console.log("自动拉起,meetingId:", options.meetingId, ",userName:", options.userName)
      this.setData({
        url: this.url + "?meetingId=" + options.meetingId + "&userName=" + options.userName
      })
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})