# 几种定投策略的仿真比较


！！以下说明或结论不构成任何建议，且难免有错误之处，仅是个人感兴趣点以及学习过程。

<!--more-->

## 策略代码

生成随机涨跌趋势，这里假设是以周为单位，并且限定了涨跌最大幅度为10%，`win_rate`表示平均胜率，表示一个周期（周）中，有`win_rate`的概率是盈利的。
```Python
def rand_rate(win_rate : float, time_steps : int):
    import random
    return [(-1 if random.random() > win_rate else 1) * random.random() / 10 for _ in range(time_steps)]
```

`sim`是仿真执行函数，执行`cases`中的策略，并放回最终的收益率。
```Python
def sim(rates, cases):
    return [case(rates) for case in cases]
```

以下是模拟的三种策略。

策略一， 起始投入1000, 设定周定投500, 但是会根据上周的涨跌幅浮动，定投额度为500减去浮动金额。所以，如果上周上涨了，本周就少定投，上周下跌了，本周就多定投，上下限分别是0和1000。
```Python
def case1(rates):
    base = 1000
    wadd = 500
    wadd_max = 1000

    nbase = base
    addon = 0
    for ra in rates:
        base = base + addon
        nbase = nbase + addon

        fb = nbase * ra
        nbase = nbase + fb

        addon = max(wadd - fb, 0)
        addon = min(addon, wadd_max)
    return (nbase - base) / base
```

策略二，一次性全部投入。
```Python
def case2(rates):
    base = 1000
    nbase = base
    for ra in rates:
        nbase = nbase + nbase * ra
    return (nbase - base) / base
```

策略三，类似策略一，但是是固定金额定投，不浮动。
```Python
def case3(rates):
    base = 1000
    wadd = 500
    nbase = base
    addon = 0
    for ra in rates:
        base = base + addon
        nbase = nbase + addon

        fb = nbase * ra
        nbase = nbase + fb

        addon = wadd
    return (nbase - base) / base
```

仿真策略。模拟3年，市场盈利概率40%～60%的情况，每个盈利概率下模拟10000次，计算平均盈利率。
```Python
def rsim():
    import numpy as np
    for r in range(40, 60, 1):
        win = []
        rates = []
        for _ in range(10000):
            rates = rand_rate(r / 100, 52 * 3)
            win.append(sim(rates, [case1, case2, case3]))
        win = np.array(win)
        for i in range(len(win[0])):
            for j in range(len(win), 0, -1):
                win[j - 1, i] = win[:j, i].mean()

        paint_rate(rates)
        paint(
            t = r,
            y=[
                {
                    'data': win[:,0],
                    'color': 'r',
                },
                {
                    'data': win[:,1],
                    'color': 'b',
                },
                {
                    'data': win[:,2],
                    'color': 'y',
                },
            ]
        )
```

## 结论

以上仿真的结果是：
1. 一次性投入可以获得很高的盈利，但是亏损在这三者中也是最大的
2. 浮动定投比定额定投可以获得更少的亏损，也比定额定投有更高的盈利

更具体的情况可以[下载源码](/statics/1ClXZt.ipynb)

