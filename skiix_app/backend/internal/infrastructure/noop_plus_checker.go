package infrastructure

// NoopPlusChecker treats every user as free-tier until subscriptions ship (Epic 3).
type NoopPlusChecker struct{}

func (NoopPlusChecker) IsPlus(_ string) (bool, error) {
	return false, nil
}
