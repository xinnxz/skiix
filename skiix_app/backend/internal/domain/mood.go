package domain

import "strings"

// PostMoodName identifies creator-tagged mood labels for Mood Feed filtering.
type PostMoodName string

// Base moods (PRD slide 03) — free for all users.
const (
	MoodChill     PostMoodName = "chill"
	MoodCreative  PostMoodName = "creative"
	MoodMotivated PostMoodName = "motivated"
	MoodSad       PostMoodName = "sad"
	MoodHype      PostMoodName = "hype"
	MoodCurious   PostMoodName = "curious"
)

// Expanded moods (PRD slide 06 — Skiix Plus) — deeper emotional states.
const (
	MoodNostalgic PostMoodName = "nostalgic"
	MoodGrateful  PostMoodName = "grateful"
	MoodFocused   PostMoodName = "focused"
	MoodPeaceful  PostMoodName = "peaceful"
	MoodRestless  PostMoodName = "restless"
	MoodInspired  PostMoodName = "inspired"
)

const (
	MoodTierFree = "free"
	MoodTierPlus = "plus"
)

// BasePostMoods — free tier (CEO decision, Ashhad Khan — June 2026).
// Product mapping: happy → chill, sad → sad, excited → hype.
var BasePostMoods = []PostMoodName{
	MoodSad, MoodChill, MoodHype,
}

// ExpandedPostMoods require Skiix Pro/Plus to tag, filter, schedule, or log history.
var ExpandedPostMoods = []PostMoodName{
	MoodCreative, MoodMotivated, MoodCurious,
	MoodNostalgic, MoodGrateful, MoodFocused, MoodPeaceful, MoodRestless, MoodInspired,
}

// ValidPostMoods is the full catalog (base + expanded).
var ValidPostMoods []PostMoodName

var (
	validMoodSet    map[PostMoodName]struct{}
	baseMoodSet     map[PostMoodName]struct{}
	expandedMoodSet map[PostMoodName]struct{}
	moodAliases     map[string]PostMoodName
	moodLabels      map[PostMoodName]string
)

func init() {
	ValidPostMoods = append(append([]PostMoodName{}, BasePostMoods...), ExpandedPostMoods...)

	validMoodSet = make(map[PostMoodName]struct{}, len(ValidPostMoods))
	for _, m := range ValidPostMoods {
		validMoodSet[m] = struct{}{}
	}
	baseMoodSet = make(map[PostMoodName]struct{}, len(BasePostMoods))
	for _, m := range BasePostMoods {
		baseMoodSet[m] = struct{}{}
	}
	expandedMoodSet = make(map[PostMoodName]struct{}, len(ExpandedPostMoods))
	for _, m := range ExpandedPostMoods {
		expandedMoodSet[m] = struct{}{}
	}

	// Legacy aliases from interim implementation.
	moodAliases = map[string]PostMoodName{
		"happy":   MoodChill,
		"excited": MoodHype,
	}

	moodLabels = map[PostMoodName]string{
		MoodChill:     "Chill",
		MoodCreative:  "Creative",
		MoodMotivated: "Motivated",
		MoodSad:       "Sad",
		MoodHype:      "Hype",
		MoodCurious:   "Curious",
		MoodNostalgic: "Nostalgic",
		MoodGrateful:  "Grateful",
		MoodFocused:   "Focused",
		MoodPeaceful:  "Peaceful",
		MoodRestless:  "Restless",
		MoodInspired:  "Inspired",
	}
}

// MoodLabel returns the display label for a canonical mood id.
func MoodLabel(name string) string {
	if label, ok := moodLabels[PostMoodName(NormalizePostMood(name))]; ok {
		return label
	}
	return name
}

// NormalizePostMood lowercases, trims, and resolves legacy aliases.
func NormalizePostMood(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	if alias, ok := moodAliases[n]; ok {
		return string(alias)
	}
	return n
}

// IsValidPostMood returns true for any base or expanded mood.
func IsValidPostMood(name string) bool {
	_, ok := validMoodSet[PostMoodName(NormalizePostMood(name))]
	return ok
}

// IsBasePostMood returns true when the mood is in the free tier.
func IsBasePostMood(name string) bool {
	_, ok := baseMoodSet[PostMoodName(NormalizePostMood(name))]
	return ok
}

// IsExpandedPostMood returns true when the mood requires Skiix Pro/Plus.
func IsExpandedPostMood(name string) bool {
	_, ok := expandedMoodSet[PostMoodName(NormalizePostMood(name))]
	return ok
}

// MoodTier returns "free" for base moods and "plus" for expanded moods.
func MoodTier(name string) string {
	if IsExpandedPostMood(name) {
		return MoodTierPlus
	}
	return MoodTierFree
}

// SQLMoodNamesCheckList returns mood ids for DB CHECK constraints.
func SQLMoodNamesCheckList() string {
	names := make([]string, len(ValidPostMoods))
	for i, m := range ValidPostMoods {
		names[i] = "'" + string(m) + "'"
	}
	return strings.Join(names, ", ")
}
