// components/watermark/watermark.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    name:String,
    meetingId:String,
    num:Number
  },

  /**
   * 组件的初始数据
   */
  data: {
    watermarkText:'',
    meetingId: '',
    num: 3
  },

  /**
   * 组件生命周期声明对象，组件的生命周期
   * ：created、attached、ready、moved、detached 
   * 将收归到 lifetimes 字段内进行声明
   * 原有声明方式仍旧有效，如同时存在两种声明方式
   * 则 lifetimes 字段内声明方式优先级最高
   */
  lifetimes:{
    attached(){
      this.setData({
        watermarkText:this.data.watermarkText + this.properties.name
      })
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {

  }
})

