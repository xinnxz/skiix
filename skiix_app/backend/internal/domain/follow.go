package domain

import "time"

type ProjectMember struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ProjectID string    `json:"project_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Follower struct {
	ID          string    `json:"id"`
	FollowerID  string    `json:"follower_id"`
	FollowingID string    `json:"following_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProjectMemberRepository interface {
	Join(userID, projectID string, role string) (already bool, err error)
	IsMember(userID, projectID string) (bool, error)
}

type FollowerRepository interface {
	Follow(followerID, followingID string) (already bool, err error)
}
