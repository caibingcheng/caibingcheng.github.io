# 像数学公式一样写C++代码


在leetcode做题的时候，遇到如下形式的递推公式：

<!--more-->

$
f(m, n) = f(m, n-1) + f(m - 1, n)
$

借助值引用，C++也可以实现形如以上公式的代码：

```C++
f(m, n) = f(m, n-1) + f(m - 1, n);
```

但是个人并**不推荐**使用这种写法，除非所写代码是比较纯粹的数学逻辑，否则可读性太低了。

以上写法的灵感来自于题[《63. 不同路径 II》](https://leetcode.cn/problems/unique-paths-ii/):

> 一个机器人位于一个 m x n 网格的左上角。机器人每次只能向下或者向右移动一步。机器人试图达到网格的右下角。现在考虑网格中有障碍物。那么从左上角到右下角将会有多少条不同的路径？ 网格中的障碍物和空位置分别用 1 和 0 来表示。

本文主题不是探讨其解法，不过先直接上带代码吧：
```C++
int uniquePathsWithObstacles(vector<vector<int>> &obstacleGrid)
{
    int m = obstacleGrid.size();
    int n = obstacleGrid[0].size();
    vector<int> fn(m * n, 0);

    // f(m, n) = g(m, n - 1) == 0 ? f(m, n-1) : 0 + g(m - 1, n) == 0 ? f(m - 1, n) : 0;
    auto g = [&](int x, int y) -> int &
    {
        return std::ref(obstacleGrid[y][x]);
    };
    auto f = [&](int x, int y) -> int &
    {
        return std::ref(fn[y * n + x]);
    };
    auto fmn = [&](int x, int y)
    {
        return (g(x, y - 1) == 0 ? f(x, y - 1) : 0) +
               (g(x - 1, y) == 0 ? f(x - 1, y) : 0);
    };

    if (g(0, 0) == 1)
        return 0;
    if (g(n - 1, m - 1) == 1)
        return 0;

    f(0, 0) = 1;
    for (int x = 1; x < n; x++)
    {
        f(x, 0) = g(x - 1, 0) == 0 ? f(x - 1, 0) : 0;
    }
    for (int y = 1; y < m; y++)
    {
        f(0, y) = g(0, y - 1) == 0 ? f(0, y - 1) : 0;
    }

    for (int y = 1; y < m; y++)
    {
        for (int x = 1; x < n; x++)
        {
            f(x, y) = fmn(x, y);
        }
    }

    return f(n - 1, m - 1);
}
```

重点关注的是$f$和$g$两个函数的写法：
```C++
auto g = [&](int x, int y) -> int &
{
    return std::ref(obstacleGrid[y][x]);
};
auto f = [&](int x, int y) -> int &
{
    return std::ref(fn[y * n + x]);
};
```

返回值是数组的引用，是左值，因此可以继续赋值，这题相较于使用`g[n][m]`和`f[n][m]`，我还是认为上述`f(x, y)`的形式可读性好一些。

