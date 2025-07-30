module PuzzlesHelper
  def puzzle_difficulty_badge_class(difficulty)
    case difficulty&.to_s
    when "easy"
      "bg-success"
    when "medium"
      "bg-warning"
    when "hard"
      "bg-danger"
    else
      "bg-secondary"
    end
  end

  def puzzle_status_badge(puzzle)
    if puzzle.published?
      content_tag :span, "Published", class: "badge bg-success"
    else
      content_tag :span, "Draft", class: "badge bg-secondary"
    end
  end
end
