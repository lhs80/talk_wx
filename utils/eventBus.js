//创建EventBus对象
let EventBus = function () {
  console.log("eventbus init...");
};
//准备数组容器
let objBus = [], arrbus = [];
//添加方法
EventBus.prototype = {
  emit: function (key, data) {
    if (key) {
      for (let i = 0, busLength = arrbus.length; i < busLength; i++) {
        let map = arrbus[i];
        if (map.k === key) {
          return map.v(data);
        }
      }
    }
    return new Promise((resolve, reject) => { resolve() })
  },
  on: function (key, action) {
    if (key && action) {
      let map = {};
      map.k = key;
      map.v = action;
      arrbus = arrbus.filter(item=>item.k!==key);//去掉重复
      arrbus.push(map);
    }
  },
};
let eventBus = new EventBus();
module.exports = {
  eventBus: eventBus
};