const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');

const { User, Post, Image, Comment } = require('../models');
const { isLoggedIn, isNotLoggedIn } = require('./middlewares');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    if (req.user) {
      const userWithoutPassword = await User.findOne({
        where: { id: req.user.id },
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            model: Post,
            attributes: ['id'],
          },
          {
            model: User,
            as: 'Followings',
            attributes: ['id'],
          },
          {
            model: User,
            as: 'Followers',
            attributes: ['id'],
          },
        ],
      });

      res.status(200).json(userWithoutPassword);
    } else {
      res.status(200).json(null);
    }
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.post('/', isNotLoggedIn, async (req, res, next) => {
  try {
    const findUser = await User.findOne({
      where: {
        email: req.body.email,
      },
    });

    if (findUser) {
      return res.status(403).send('등록된 이메일입니다.');
    }

    const findNickname = await User.findOne({
      where: {
        nickname: req.body.nickname,
      },
    });

    if (findNickname) {
      return res.status(403).send('등록된 닉네임입니다.');
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 12);

    await User.create({
      email: req.body.email,
      nickname: req.body.nickname,
      password: hashedPassword,
    });

    res.status(201).send('ok');
  } catch (err) {
    console.error(err);

    next(err);
  }
});

router.get('/followers', isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(403).send('없는 사람의 팔로워 정보는 찾을 수 없습니다!!');
    }

    const followers = await user.getFollowers({
      attributes: ['id', 'nickname'],
      limit: parseInt(req.query.limit, 10),
    });

    res.status(200).json(followers);
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.get('/followings', isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(403).send('없는 사람의 팔로잉 정보는 찾을 수 없습니다!!');
    }

    const followings = await user.getFollowings({
      attributes: ['id', 'nickname'],
      limit: parseInt(req.query.limit, 10),
    });

    res.status(200).json(followings);
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const fullUserWithoutPassword = await User.findOne({
      where: { id: req.params.id },
      attributes: {
        exclude: ['password'],
      },
      include: [
        {
          model: Post,
          attributes: ['id'],
        },
        {
          model: User,
          as: 'Followings',
          attributes: ['id'],
        },
        {
          model: User,
          as: 'Followers',
          attributes: ['id'],
        },
      ],
    });

    if (fullUserWithoutPassword) {
      const data = fullUserWithoutPassword.toJSON();
      data.Posts = data.Posts.length;
      data.Followings = data.Followings.length;
      data.Followers = data.Followers.length;
      res.status(200).json(data);
    } else {
      res.status(404).json('존재하지 않는 사용자입니다.');
    }
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.get('/:userId/posts', async (req, res, next) => {
  try {
    const where = { UserId: req.params.userId };

    if (parseInt(req.query.lastId, 10)) {
      where.id = { [Op.lt]: parseInt(req.query.lastId, 10) };
    }

    const posts = await Post.findAll({
      where,
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Post,
          as: 'Retweet',
          include: [
            {
              model: User,
              attributes: ['id', 'nickname'],
            },
            {
              model: Image,
            },
          ],
        },
        {
          model: User,
          attributes: ['id', 'nickname'],
        },
        {
          model: Image,
        },
        {
          model: Comment,
          include: [
            {
              model: User,
              attributes: ['id', 'nickname'],
            },
          ],
        },
        {
          model: User,
          as: 'Likers',
          attributes: ['id', 'nickname'],
        },
      ],
    });

    res.status(200).json(posts);
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.post('/login', isNotLoggedIn, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error(err);

      return next(err);
    }

    if (info) {
      return res.status(401).send(info.reason);
    }

    return req.logIn(user, async (loginErr) => {
      if (loginErr) {
        console.error(loginErr);

        return next(loginErr);
      }

      const userWithoutPassword = await User.findOne({
        where: { id: user.id },
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            model: Post,
            attributes: ['id'],
          },
          {
            model: User,
            as: 'Followings',
            attributes: ['id'],
          },
          {
            model: User,
            as: 'Followers',
            attributes: ['id'],
          },
        ],
      });

      return res.status(200).json(userWithoutPassword);
    });
  })(req, res, next);
});

router.post('/logout', isLoggedIn, (req, res) => {
  req.logout();
  req.session.destroy();

  res.send('ok');
});

router.patch('/nickname', isLoggedIn, async (req, res, next) => {
  try {
    await User.update(
      {
        nickname: req.body.nickname,
      },
      {
        where: { id: req.user.id },
      }
    );

    res.status(200).json({ nickname: req.body.nickname });
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.patch('/:userId/follow', isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
    });

    if (!user) {
      return res.status(403).send('없는 사람을 팔로우할 수 없습니다!!');
    }

    await user.addFollowers(req.user.id);

    res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.delete('/:userId/follow', isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
    });

    if (!user) {
      return res.status(403).send('없는 사람을 언팔로우할 수 없습니다!!');
    }

    await user.removeFollowers(req.user.id);

    res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
  } catch (error) {
    console.error(error);

    next(error);
  }
});

router.delete('/follower/:userId', isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
    });

    if (!user) {
      return res.status(403).send('없는 사람을 차단할 수 없습니다!!');
    }

    await user.removeFollowings(req.user.id);

    res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
  } catch (error) {
    console.error(error);

    next(error);
  }
});

module.exports = router;
