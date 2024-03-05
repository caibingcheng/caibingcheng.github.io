# C++解包函数tie的用法


## tie

std::tie会把变量打包成一个tuple(pair)，实现变量赋值；这个行为叫做**解包**


<!--more-->

```cpp
tuple<int,double,string> t3 = {1, 2.0, "3"};
int i; double d; string s;
tie(i, d, s) = t3;
```
以上，i, d, s就可以被赋值为与tuple对应元素的值，在应用中，这在处理函数多返回值的时候比较有用。

同时，也提供了占位符，std::ignore来忽略某些值。

```cpp
tie(i, std::ignore, s) = t3;
```

或者可以用于比较， 表示的是与逻辑，即元素全部满足才满足，有一个不满足就是不满足。

```cpp
struct S {
    int n;
    std::string s;
    float d;
    bool operator<(const S& rhs) const
    {
        // 比较 n 与 rhs.n,
        // 然后为 s 与 rhs.s,
        // 然后为 d 与 rhs.d
        return std::tie(n, s, d) < std::tie(rhs.n, rhs.s, rhs.d);
    }
};
```

