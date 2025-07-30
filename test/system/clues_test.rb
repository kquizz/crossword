require "application_system_test_case"

class CluesTest < ApplicationSystemTestCase
  setup do
    @clue = clues(:one)
  end

  test "visiting the index" do
    visit clues_url
    assert_selector "h1", text: "Clues"
  end

  test "should create clue" do
    visit clues_url
    click_on "New clue"

    fill_in "Answer", with: @clue.answer
    fill_in "Category", with: @clue.category
    fill_in "Clue text", with: @clue.clue_text
    fill_in "Difficulty", with: @clue.difficulty
    click_on "Create Clue"

    assert_text "Clue was successfully created"
    click_on "Back"
  end

  test "should update Clue" do
    visit clue_url(@clue)
    click_on "Edit this clue", match: :first

    fill_in "Answer", with: @clue.answer
    fill_in "Category", with: @clue.category
    fill_in "Clue text", with: @clue.clue_text
    fill_in "Difficulty", with: @clue.difficulty
    click_on "Update Clue"

    assert_text "Clue was successfully updated"
    click_on "Back"
  end

  test "should destroy Clue" do
    visit clue_url(@clue)
    click_on "Destroy this clue", match: :first

    assert_text "Clue was successfully destroyed"
  end
end
