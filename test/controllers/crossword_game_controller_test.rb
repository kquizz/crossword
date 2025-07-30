require "test_helper"

class CrosswordGameControllerTest < ActionDispatch::IntegrationTest
  test "should get play" do
    get crossword_game_play_url
    assert_response :success
  end

  test "should get create" do
    get crossword_game_create_url
    assert_response :success
  end
end
