package domain

type SearchResultDTO struct {
	Users    []User   `json:"users,omitempty"`
	Posts    []Post   `json:"posts,omitempty"`
	Hashtags []string `json:"hashtags,omitempty"`
}

type HashtagTrendDTO struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

type SearchRepository interface {
	SearchUsers(query string, limit int) ([]User, error)
	SearchPosts(query string, limit int) ([]Post, error)
	GetTrendingHashtags(limit int) ([]HashtagTrendDTO, error)
	GetTrendingPosts(limit int) ([]Post, error)
}

type SearchUsecase interface {
	Search(query string, searchType string, limit int) (any, error)
	GetTrendingHashtags(limit int) ([]HashtagTrendDTO, error)
	GetTrendingPosts(limit int) ([]Post, error)
}
