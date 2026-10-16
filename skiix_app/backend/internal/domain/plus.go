package domain

// PlusSubscriberChecker reports whether a user has an active Skiix Plus subscription.
// Epic 3 will provide a real implementation backed by the subscriptions table.
type PlusSubscriberChecker interface {
	IsPlus(userID string) (bool, error)
}
