# 车运动时和静止时被鸟拉屎的概率


这是我在下班路上想到的问题. 因为看见路边的车上会有鸟屎, 就想, 运动的汽车和停下的汽车, 被鸟拉屎的概率一样不一样呢?

<!--more-->

如果车停在树下, 而树上比天上更容易产生鸟的话, 那树下的车被鸟拉屎的概率可能更高些(但是也不一定呀, 因为车一直在运动, 经过一些地方的时候, 这些地点上方的鸟可能会很多, 导致路途上平均的鸟的数量更多). 不过当时我也没想到很好的数学证明的方法, 因为车运动的情况比较复杂了, 当时没想清楚运动的概率应该怎么算.

这东西代码模拟不算复杂, 所以, 就假设, 运动的车和静止的车是在同一条大马路上, 然后运动的车是在马路上做往复运动, 车的运动是匀速且离散的(物理上也确实是离散的, 不过我们先在数学上假设是离散的), 也就是说, 每一个单位时间观察, 车总是在整数倍的单位长度的位置上, 最重要的是假设每个单位长度上, 鸟拉屎的概率相同. (写道这里仔细想想, 这时候运动的车和静止的车被鸟拉屎的概率应该是一样的, 不过当时我没想清楚, 所以这里还是把过程贴上来吧~)

以下是定义的一些状态, 如路的长度, 鸟拉屎的概率, 车的长度等等:
```python
road_length = 100 ## 路的长度
shit_rate = 0.3 ## 鸟拉屎的概率
shit_pos = [p for p in range(0, road_length)] ## 路上可能出现鸟屎的位置, 假设等概率
car_length = 4 ## 车的长度
car_speed = 1 ## 车的速度
car_start = 0 ## 运动的车开始的位置
static_car = 0 ## 对照组, 静止的车的位置
sim_times = 100000000 ## 模拟时长
static_count = 0 ## 对照组, 静止的车被鸟拉屎的次数
move_count = 0 ## 运动的车被鸟拉屎的次数
```

现在要生成一个鸟拉屎的位置, 我们先判断会不会有鸟拉屎, 然后在给它安排一个随机的位置:
```python
## 生成一个鸟拉屎的位置, 如果这个时间点没有鸟拉屎, 则输出-1(假设拉在了别的地方)
import random
def generate_shit(shit_rate, shit_pos):
    should_shit = random.random() < shit_rate
    shit_position = -1 if not should_shit else shit_pos[random.randrange(len(shit_pos))]
    return shit_position
```

车是往复运动的, 所以到了道路末尾又得掉头, 这里我们就理想化了, 假设车的速度可以直接反转:
```python
## 车的运动函数, 如果车运动到了路的末尾, 则又从末尾向头运动, 假设匀速
direction = car_speed
def move_car(car_start, car_length, road_length):
    global direction
    if (car_start + car_length) >= road_length:
        direction = -car_speed
    if car_start <= 0:
        direction = car_speed
    car_start = car_start + direction
    return car_start
```

根据鸟拉屎的位置, 以及车的长度, 判断鸟屎有没有拉在车上:
```python
## 判断鸟屎是否拉在了车上
def hashit_car(car_start, car_length, shit_position):
    hashit = 1 if (car_start <= shit_position and shit_position < (car_start + car_length)) else 0
    return hashit
```

开始模拟, 我这里的数据是模拟一亿次:
```python
for _ in range(sim_times):
    shit_position = generate_shit(shit_rate, shit_pos)
    car_start = move_car(car_start, car_length, road_length)

    has_static_shit = hashit_car(static_car, car_length, shit_position)
    has_move_shit = hashit_car(car_start, car_length, shit_position)

    static_count = static_count + has_static_shit
    move_count = move_count + has_move_shit

#     print(shit_position, static_car, has_static_shit, static_count, car_start, has_move_shit, move_count)

print(static_count, move_count, sim_times)
print(static_count / sim_times, move_count / sim_times)
```

得到静止车和运动车被鸟拉屎的概率几乎相同, 为0.012, 这个概率就是(鸟拉屎概率 x (车的长度 / 路的长度)):

    1200522 1200946 100000000
    0.01200522 0.01200946

以上结论的主要条件就是等概率拉屎, 但是我认为等概率拉屎这个假设是有意义的, 因为鸟无法存储粪便, 所以即使在飞的时候也可能拉屎. 但是鸟呆在树上的时间会更长吗? 我不知道, 就假设和空中等价吧. (这里需要考虑的就是, 鸟在树上一段时间之后就会飞走, 而树的高度又相对有限, 而空中的高度相对无限, 所以空中有概率叠加多只鸟...不过这些太复杂了, 也没研究过, 所以, 还是假设一样一样一样)

我想起来以前想过一个问题, 下雨的时候跑回去和走回去会淋湿一样吗? 先不考虑空气动力因素(因为跑回去的时候周围空气流动速度快, 会把雨水'吸'过来, 但是人跑的速度也不会很快, 所以先不考虑吧). 下雨至少可以认为是每个地方等概率的雨了, 所以现在好回答这个问题: 如果是相同的淋雨时间, 那么不管跑还是走还是不动, 淋湿程度是相同的; 如果淋雨时间不同, 那么呆在雨里的时间更短, 则淋湿程度越低(也就是跑), 不过淋湿是会饱和的, 如果湿透了, 那就不能更湿了.
