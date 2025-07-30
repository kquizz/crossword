module CrosswordGameHelper
  def difficulty_color(difficulty)
    case difficulty&.to_s
    when "easy"
      "success"
    when "medium"
      "warning"
    when "hard"
      "danger"
    when "expert"
      "dark"
    else
      "secondary"
    end
  end
end
