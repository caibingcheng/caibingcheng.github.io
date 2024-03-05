# 《UCB CS61a SICP Python 中文》一周目笔记(二)




在上一章中我们主要学习了函数. 关注了函数的调用过程, 也学习了高阶函数. 高阶函数实际上是比较"古老"的技术, 在Lisp原生支持. 但是C语言似乎并没有或者很难实现高阶函数, 不过这一点在C++中有所缓解. 这一篇主要关注程序的数据.

<!--more-->



## 使用对象构建抽象

> 数据抽象的基本概念是构造操作抽象数据的程序。也就是说，我们的程序应该以一种方式来使用数据，对数据做出尽可能少的假设。

这句话引起了我对如何构建类或者结构体的思考。

通俗的说，抽象某个数据时，应该让用户对该数据做出尽可能少的思考，类似于[上一篇](/202108/sicp-python-read1/)函数抽象，数据抽象也应该让用户感觉起来非常的自然，而不会惊讶于数据抽象的某些表示。要做到这一点，我们确实需要考虑用户可能对这个数据抽象所进行的操作，并且可能需要删除一些没必要/意料之外的操作。

下面这句话比较好解释上面的思想：

> 复数有两种不同表示（平面坐标和极坐标），它们适用于不同的操作。然而，从一些人编写使用复数的程序的角度来看，数据抽象的原则表明，所有操作复数的运算都应该可用，无论计算机使用了哪个表示。

如果打算做复数的数据抽象，那么我们确实应该考虑用户可能的操作。有些用户可能使用平面坐标表示，有些用户可能使用极坐标表示。并且这两种表示确实是复数的常用表示方法。同时，平面表示的复数和极坐标表示的复数也不应该有明显的界限， 这一点表现在两者的运算操作上。想想在学校里学习的复数运算，经常也会涉及平面坐标和极坐标的相互转换和运算。



### 构造器和选择器



#### 构造器

构造器的概念类似于C++中的构造函数。通过SICP我的认知是：构造器只负责构造当前抽象的数据。

举个例子：文中的有理数构造， 就只构造有理数的分子和分母，其他无关的元素没有参与构造，也不应该参与构造。

在代码编写过程中，经常容易陷入的误区是，喜欢在构造函数里面做一些和构造无关的操作，比如某些初始化。这些初始化的工作应不应该放在构造函数中呢？没有见过有比较值得信赖的定论。但是目前来看，与数据抽象无关的元素不应该放在构造函数中构造（初始化）。

所以，即使抽象某个数据的时候，看似很简单，但是还是应该思考清楚哪些是这个数据本身的属性，哪些是额外的属性。本身的属性就需要在构造的时候初始化，额外的属性则不需要在构造的时候初始化。



#### 选择器

以C++举例，和一般认知一样， 我们不应该把成员变量写在public可见性下，这样会误导用户，使用户直接取用或者修改成员变量的值， 这时候我们应该为运行用户操作的变量提供选择器。 为什么需要这样？ 下面一段例子很好：

```C++
template<typename T>
class Math{
public:
    void set(const T&);
	T get();
    T sqrt();
    T square();
    //...
private:
    T m_source;
};
```

如上，我们使用set和get方法来选择元素，而不是直接访问元素，这有什么好处呢？

1. 隔离用户和抽象的数据；
2. **统一接口**；

第1点比较好理解，通过选择器访问元素，我们可以在选择器函数中执行一些额外的操作，而用户不需要关心这些操作就能得到他们期望的结果。

关于第2点， 如果我们不使用选择器访问元素，而让用户有权直接访问到元素，则会造成接口的不统一。比如用户想访问元素本身时，可以直接访问元素：

```
math.m_source;
```

用户甚至可以修改元素的值，而不用通知类。

如果用户想访问元素的平方根或者平方时，则需要访问：

```
math.srqt();
math.square();
```

这和对元素的访问是不一样的。所以，添加选择器方法后，可以规范用户对抽象数据的操作行为。

复数的例子很好：

```python
class ComplexRI(object):
    def __init__(self, real, imag):
        self.real = real
        self.imag = imag
	@property
    def magnitude(self):
        return (self.real ** 2 + self.imag ** 2) ** 0.5
    @property
    def angle(self):
        return atan2(self.imag, self.real)
    def __repr__(self):
        return 'ComplexRI({0}, {1})'.format(self.real, self.imag)

class ComplexMA(object):
    def __init__(self, magnitude, angle):
        self.magnitude = magnitude
        self.angle = angle
    @property
    def real(self):
        return self.magnitude * cos(self.angle)
    @property
    def imag(self):
        return self.magnitude * sin(self.angle)
    def __repr__(self):
        return 'ComplexMA({0}, {1})'.format(self.magnitude, self.angle)
```

python有property这个修饰器，所以可以把需要被计算的量当做属性一样访问。比如上例，我们可以像访问实部虚部一样的访问模长和角度。对于C++这种类型的语言，都使用选择器方法可能就比较好了。



### 约束传播

![约束传播](https://wizardforcel.gitbooks.io/sicp-py/content/img/constraints.png "约束传播")

上图是关于摄氏度和华氏度转换的约束网络，通过设置摄氏度的值可以得到华氏度的结果，设置华氏度的值可以得到摄氏度的结果，只需要通过这个网络传播即可。

参考[原文](https://wizardforcel.gitbooks.io/sicp-py/content/2.4.html)，我实现了以下的约束传播，另外还可以参考[这篇文章](http://notebook.xyli.me/SICP/propagation-of-constraints/)，这里对约束传播讲地更清楚。

定义连接器，需要的方法有：
1. has_val: 判断值是否已知
2. set_val: 更新连接器的值
3. val: 获取连接器的值
4. connect: 关联连接器和其约束
5. forget: 让连接器丢弃现在的值

需要的容器有：
1. value: 保存连接器的值，如果是None则代表没有值
2. constraints: 保存所有与该连接器相关的约束，如果连接器的值更新了，则需要通知其他约束更新
3. informant: 描述连接器的最后一次修改者，以防止连接器的值被不允许的对象修改


```Python
class connector():
    def __init__(self, name=None):
        self._name = name
        self._value = None
        self._constraints = []
        self._informant = None

    def _notify(self, source, message):
        notify = {
            'new_val': lambda constraint : constraint.new_val(),
            'forget': lambda constraint : constraint.forget(),
        }
        for constraint in self._constraints:
            if source != constraint:
                notify[message](constraint)

    @property
    def val(self):
        return self._value

    @property
    def has_val(self):
        return self._value is not None

    def set_val(self, source, val):
        if self._value is None:
            self._informant, self._value = source, val
            if self._name is not None:
                print(self._name, '=', val)
            self._notify(source, 'new_val')
        else:
            if self._value != val:
                print('Contradiction detected:', self._value, 'vs', val)

    def connect(self, constraint):
        self._constraints.append(constraint)

    def forget(self, source):
        if self._informant == source:
            self._informant, self._value = None, None
            self._notify(source, 'forget')
```

以下是构造约束条件，这里定义的是三元约束条件，其设计思想是，如果约束条件相关的某两个连接器的值已知，则可以更新另外一个连接器的值。
```Python
class ternary_constraint():
    def __init__(self, a, b, c, ab, ca, cb):
        self._a = a
        self._b = b
        self._c = c
        self._ab = ab
        self._ca = ca
        self._cb = cb
        for connector in (self._a, self._b, self._c):
            connector.connect(self)

    def new_val(self):
        av, bv, cv = [connector.has_val for connector in (self._a, self._b, self._c)]
        if av and bv:
            self._c.set_val(self, self._ab(self._a.val, self._b.val))
        elif av and cv:
            self._b.set_val(self, self._ca(self._c.val, self._a.val))
        elif bv and cv:
            self._a.set_val(self, self._cb(self._c.val, self._b.val))
        print("not satisfied")

    def forget(self):
        for connector in (self._a, self._b, self._c):
            connector.forget(self)
```

按照华氏度和设置度转换的需求，构造以下几种约束条件：
```Python
def adder(a, b, c):
    from operator import add, sub
    return ternary_constraint(a, b, c, add, sub, sub)

def multiplier(a, b, c):
    from operator import mul, truediv
    return ternary_constraint(a, b, c, mul, truediv, truediv)

def constant(connector, value):
    constraint = {}
    connector.set_val(constraint, value)
    return constraint
```

组合约束条件和连接器，实现华氏度和摄氏度转换的约束传播网络：
```Python
def make_converter(c, f):
    """Connect c to f with constraints to convert from Celsius to Fahrenheit."""
    u, v, w, x, y = [connector() for _ in range(5)]
    multiplier(c, w, u)
    multiplier(v, x, u)
    adder(v, y, f)
    constant(w, 9)
    constant(x, 5)
    constant(y, 32)
```

只需要某个条件已知，就可以按照约束传播网络的约束，更新其他未知的值：
```Python
celsius = connector('Celsius')
fahrenheit = connector('Fahrenheit')
make_converter(celsius, fahrenheit)

celsius.set_val('c', 25)
celsius.forget('c')
celsius.set_val('c', 30)
```

### 函数和方法

【不重要的】操作对象或执行对象特定计算的函数叫做方法。

有以上的概念，需要思考的是，什么时候应该实现为函数， 什么时候应该实现为方法？ 这将有助于我们理解一个类里面应该包含什么，不应该包含什么。

我观察到的现象是，所有方法都会操作对象的数据，读或者写。如果某个操作需要读入某个对象的某个数据，但是并不会对其产生影响，输出也与这个类完全无关，那应该定义为一个方法吗？我认为是不应该的。

比如STL中的容器。

`std::vector`是一个容器，其作用是存储数据。其基本操作就是，添加数据，删除数据，统计数据长度。对数据排序，这算不算是容器的基本方法呢？目前可以看到，STL不认为这是容器的基本方法，所以STL实现的容器是很纯粹的。但是在Python里面，`sort`一般是可变容器的默认方法。



### 通过字典实现类和对象

在Linux内核源码中，可以看到不少这样的操作：

将一系列函数指针包装为一个结构体`operation`，比如`open`、`close`等等，然后其他抽象数据类型的结构结构体（比如VFS，虚拟文件系统）就会包含`operation`这个结构体，这时候就像是VFS自身的结构体包含了`operation`里面的操作，是一个类。

在Python里面自定义一个类更现代：

```python
def make_instance(cls):
    """Return a new object instance, which is a dispatch dictionary."""
    def get_value(name):
        if name in attributes:
            return attributes[name]
        else:
            value = cls['get'](name)
            return bind_method(value, instance)
    def set_value(name, value):
        attributes[name] = value
    attributes = {}
    instance = {'get': get_value, 'set': set_value}
    return instance

def bind_method(value, instance):
    """Return a bound method if value is callable, or value otherwise."""
    if callable(value):
        def method(*args):
            return value(instance, *args)
        return method
    else:
        return value

def make_class(attributes, base_class=None):
    """Return a new class, which is a dispatch dictionary."""
    def get_value(name):
        if name in attributes:
            return attributes[name]
        elif base_class is not None:
            return base_class['get'](name)
    def set_value(name, value):
        attributes[name] = value
    def new(*args):
        return init_instance(cls, *args)
    cls = {'get': get_value, 'set': set_value, 'new': new}
    return cls

def init_instance(cls, *args):
    """Return a new object with type cls, initialized with args."""
    instance = make_instance(cls)
    init = cls['get']('__init__')
    if init:
        init(instance, *args)
    return instance

def make_account_class():
    """Return the Account class, which has deposit and withdraw methods."""
    def __init__(self, account_holder):
        self['set']('holder', account_holder)
        self['set']('balance', 0)
    def deposit(self, amount):
        """Increase the account balance by amount and return the new balance."""
        new_balance = self['get']('balance') + amount
        self['set']('balance', new_balance)
        return self['get']('balance')
    def withdraw(self, amount):
        """Decrease the account balance by amount and return the new balance."""
        balance = self['get']('balance')
        if amount > balance:
            return 'Insufficient funds'
        self['set']('balance', balance - amount)
        return self['get']('balance')
    return make_class({'__init__': __init__,
                       'deposit':  deposit,
                       'withdraw': withdraw,
                       'interest': 0.02})

Account = make_account_class()
jim_acct = Account['new']('Jim')
jim_acct['get']('holder')
jim_acct['get']('deposit')(20)
jim_acct['set']('interest', 0.04)
```








