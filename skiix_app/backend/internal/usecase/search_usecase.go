package usecase

import (
	"github.com/skiix-backend/internal/domain"
)

type searchUsecase struct {
	searchRepo domain.SearchRepository
}

func NewSearchUsecase(searchRepo domain.SearchRepository) domain.SearchUsecase {
	return &searchUsecase{searchRepo: searchRepo}
}

func (u *searchUsecase) Search(query string, searchType string, limit int) (any, error) {
	if searchType == "users" {
		return u.searchRepo.SearchUsers(query, limit)
	}
	if searchType == "posts" {
		return u.searchRepo.SearchPosts(query, limit)
	}

	var result domain.SearchResultDTO
	users, _ := u.searchRepo.SearchUsers(query, limit/2)
	posts, _ := u.searchRepo.SearchPosts(query, limit/2)
	result.Users = users
	result.Posts = posts
	return result, nil
}

func (u *searchUsecase) GetTrendingHashtags(limit int) ([]domain.HashtagTrendDTO, error) {
	return u.searchRepo.GetTrendingHashtags(limit)
}

func (u *searchUsecase) GetTrendingPosts(limit int) ([]domain.Post, error) {
	return u.searchRepo.GetTrendingPosts(limit)
}
