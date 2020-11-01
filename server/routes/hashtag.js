const express = require('express');

const { Hashtag, Post, User, Image, Comment } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/:hashtag', async (req, res, next) => {
  try {
    const where = {};

    if (parseInt(req.query.lastId, 10)) {
      where.id = { [Op.lt]: parseInt(req.query.lastId, 10) };
    }

    const posts = await Post.findAll({
      where,
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Hashtag,
          where: {
            name: decodeURIComponent(req.params.hashtag),
          },
        },
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

module.exports = router;
