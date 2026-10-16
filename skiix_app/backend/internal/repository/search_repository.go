package repository

import (
	"database/sql"

	"github.com/skiix-backend/internal/domain"
)

type PostgresSearchRepository struct {
	db *sql.DB
}

func NewPostgresSearchRepository(db *sql.DB) domain.SearchRepository {
	return &PostgresSearchRepository{db: db}
}

func (r *PostgresSearchRepository) SearchUsers(query string, limit int) ([]domain.User, error) {
	searchQuery := `
		SELECT id, username, email, created_at FROM users
		WHERE username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
		LIMIT $2
	`
	rows, err := r.db.Query(searchQuery, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, nil
}

func (r *PostgresSearchRepository) SearchPosts(query string, limit int) ([]domain.Post, error) {
	searchQuery := `
		SELECT id, user_id, content, visibility, like_count, comment_count, created_at
		FROM posts
		WHERE visibility = 'public' AND content ILIKE '%' || $1 || '%'
		ORDER BY created_at DESC LIMIT $2
	`
	rows, err := r.db.Query(searchQuery, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.Post
	for rows.Next() {
		var p domain.Post
		if err := rows.Scan(&p.ID, &p.UserID, &p.Content, &p.Visibility, &p.LikeCount, &p.CommentCount, &p.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}

func (r *PostgresSearchRepository) GetTrendingHashtags(limit int) ([]domain.HashtagTrendDTO, error) {
	query := `
		SELECT category_name, COUNT(*) as count
		FROM post_categories
		GROUP BY category_name
		ORDER BY count DESC
		LIMIT $1
	`
	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.HashtagTrendDTO
	for rows.Next() {
		var t domain.HashtagTrendDTO
		if err := rows.Scan(&t.Tag, &t.Count); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, nil
}

func (r *PostgresSearchRepository) GetTrendingPosts(limit int) ([]domain.Post, error) {
	query := `
		SELECT id, user_id, content, visibility, like_count, comment_count, created_at
		FROM posts
		WHERE visibility = 'public'
		ORDER BY like_count DESC, created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.Post
	for rows.Next() {
		var p domain.Post
		if err := rows.Scan(&p.ID, &p.UserID, &p.Content, &p.Visibility, &p.LikeCount, &p.CommentCount, &p.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}
