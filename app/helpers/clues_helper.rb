module CluesHelper
  def difficulty_badge_class(difficulty)
    case difficulty&.downcase
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
end
